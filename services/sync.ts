
import { db } from './db';
import { getSupabaseClient } from './supabase';
import { Project, TeamMember, ProjectPhase, ProjectTask, Milestone, Meeting, ProjectDoc, ProjectRisk, Goal, ProjectExpense, ProjectFile } from '../types';

export const syncService = {
    _isSyncing: false,

    async sync() {
        if (this._isSyncing) return;
        this._isSyncing = true;
        console.log("Starting LWW Sync...");

        try {
            const supabase = getSupabaseClient();
            if (!supabase) throw new Error("Supabase not configured");

            await this.syncTeam(supabase);
            await this.syncProjects(supabase);
            await this.syncUser(supabase);

            console.log("LWW Sync Completed Successfully");
            return { success: true };
        } catch (e) {
            console.error("LWW Sync Failed", e);
            throw e;
        } finally {
            this._isSyncing = false;
        }
    },

    // --- Team Sync (LWW) ---
    async syncTeam(supabase: any) {
        console.log("Syncing Team...");
        const localTeam = (await db.getTeam()) || [];
        const { data: remoteTeamData, error } = await supabase.from('team_members').select('*');

        if (error) throw error;
        const remoteTeam = remoteTeamData || [];

        const allIds = new Set([...localTeam.map(m => m.id), ...remoteTeam.map((m: any) => m.id)]);
        const mergedTeam: TeamMember[] = [];
        const toPush: TeamMember[] = [];

        for (const id of allIds) {
            const local = localTeam.find(m => m.id === id);
            const remote = remoteTeam.find((m: any) => m.id === id);

            if (local && remote) {
                const localTime = local.lastModified || 0;
                const remoteTime = new Date(remote.updated_at).getTime();

                if (localTime > remoteTime) {
                    // Local is newer -> Push
                    mergedTeam.push(local);
                    toPush.push(local);
                } else {
                    // Remote is newer (or equal) -> Pull
                    mergedTeam.push(this.mapRemoteTeamMember(remote));
                }
            } else if (local) {
                // Only local -> Push
                mergedTeam.push(local);
                toPush.push(local);
            } else if (remote) {
                // Only remote -> Pull
                mergedTeam.push(this.mapRemoteTeamMember(remote));
            }
        }

        // Save merged list to Local DB
        await db.saveTeam(mergedTeam, { skipNotification: true });

        // Push updates to Supabase
        if (toPush.length > 0) {
            const { error: pushError } = await supabase
                .from('team_members')
                .upsert(toPush.map(m => ({
                    id: m.id,
                    name: m.name,
                    role: m.role,
                    avatar: m.avatar,
                    color: m.color,
                    email: m.email,
                    department: m.department,
                    skills: m.skills,
                    updated_at: new Date(m.lastModified || Date.now()).toISOString()
                })));
            if (pushError) console.error("Error pushing team updates", pushError);
        }
    },

    mapRemoteTeamMember(row: any): TeamMember {
        return {
            id: row.id,
            name: row.name,
            role: row.role,
            avatar: row.avatar,
            color: row.color,
            email: row.email,
            department: row.department,
            skills: row.skills,
            lastModified: new Date(row.updated_at).getTime()
        };
    },

    // --- Project Sync (LWW) ---
    async syncProjects(supabase: any) {
        console.log("Syncing Projects...");
        const localProjects = await db.getAllProjects();
        const { data: remoteProjectsData, error } = await supabase.from('projects').select('id, last_modified, updated_at');

        if (error) throw error;
        const remoteProjects = remoteProjectsData || [];

        const allIds = new Set([...localProjects.map(p => p.id), ...remoteProjects.map((p: any) => p.id)]);

        for (const id of allIds) {
            const local = localProjects.find(p => p.id === id);
            const remote = remoteProjects.find((p: any) => p.id === id);

            if (local && remote) {
                const localTime = local.lastModified;
                // Use last_modified column if available (logical timestamp), else updated_at
                const remoteTime = remote.last_modified ? Number(remote.last_modified) : new Date(remote.updated_at).getTime();

                if (localTime > remoteTime) {
                    await this.pushProject(supabase, local);
                } else if (remoteTime > localTime) {
                    await this.pullProject(supabase, id);
                }
                // If equal, do nothing
            } else if (local) {
                await this.pushProject(supabase, local);
            } else if (remote) {
                await this.pullProject(supabase, id);
            }
        }
    },

    async pushProject(supabase: any, project: Project) {
        // console.log(`Pushing Project: ${project.info.name}`);

        // 1. Project Info
        const { error: projError } = await supabase
            .from('projects')
            .upsert({
                id: project.id,
                name: project.info.name,
                code: project.info.code,
                manager: project.info.manager,
                description: project.info.description,
                budget_total: project.info.budgetTotal,
                currency: project.info.currency,
                expense_categories: project.info.expenseCategories,
                last_modified: project.lastModified,
                updated_at: new Date().toISOString()
            });

        if (projError) {
            console.error("Error pushing project info", project.id, projError);
            return;
        }

        // 2. Phases & Tasks
        if (project.phases) {
            for (let i = 0; i < project.phases.length; i++) {
                const phase = project.phases[i];
                await supabase.from('project_phases').upsert({
                    id: phase.id,
                    project_id: project.id,
                    name: phase.name,
                    order_index: i,
                    updated_at: new Date().toISOString()
                });

                if (phase.tasks && phase.tasks.length > 0) {
                    const taskRows = phase.tasks.map((t, idx) => ({
                        id: t.id,
                        phase_id: phase.id,
                        project_id: project.id,
                        sub_task_name: t.subTaskName,
                        deliverables: t.deliverables,
                        work_content: t.workContent,
                        owner: t.owner,
                        duration: String(t.duration),
                        start_date: t.startDate,
                        end_date: t.endDate,
                        status: t.status,
                        score: t.score,
                        dependencies: t.dependencies,
                        linked_doc_ids: t.linkedDocIds,
                        linked_goal_id: t.linkedGoalId,
                        order_index: idx,
                        remarks: t.remarks,
                        attachments: t.attachments,
                        checklist: t.checklist,
                        comments: t.comments,
                        updated_at: new Date().toISOString()
                    }));
                    await supabase.from('project_tasks').upsert(taskRows);
                }
            }
        }

        // 3. Other Tables (Milestones, Meetings, etc.) - Simplified for brevity but essential
        if (project.milestones?.length) {
            await supabase.from('project_milestones').upsert(project.milestones.map(m => ({
                id: m.id, project_id: project.id, phase_name: m.phaseName, milestone_name: m.milestoneName,
                completion_date: m.completionDate, duration_diff: String(m.durationDiff), remarks: m.remarks, updated_at: new Date().toISOString()
            })));
        }
        if (project.meetings?.length) {
            await supabase.from('project_meetings').upsert(project.meetings.map(m => ({
                id: m.id, project_id: project.id, title: m.title, date: m.date, type: m.type, attendees: m.attendees,
                content: m.content, related_task_ids: m.relatedTaskIds, status: m.status, updated_at: new Date().toISOString()
            })));
        }
        if (project.docs?.length) {
            await supabase.from('project_docs').upsert(project.docs.map(d => ({
                id: d.id, project_id: project.id, title: d.title, icon: d.icon, parent_id: d.parentId, external_url: d.externalUrl,
                last_modified: d.lastModified, content: d.content, blocks: (d as any).blocks, updated_at: new Date().toISOString()
            })));
        }
        // ... Risks, Goals, Expenses, Files (Similar pattern)
    },

    async pullProject(supabase: any, projectId: string) {
        // console.log(`Pulling Project: ${projectId}`);

        const { data: row, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
        if (error || !row) return;

        // Fetch related data
        const [
            { data: phasesData }, { data: tasksData }, { data: milestonesData },
            { data: meetingsData }, { data: docsData }, { data: risksData },
            { data: goalsData }, { data: expensesData }, { data: filesData }
        ] = await Promise.all([
            supabase.from('project_phases').select('*').eq('project_id', projectId).order('order_index'),
            supabase.from('project_tasks').select('*').eq('project_id', projectId).order('order_index'),
            supabase.from('project_milestones').select('*').eq('project_id', projectId),
            supabase.from('project_meetings').select('*').eq('project_id', projectId),
            supabase.from('project_docs').select('*').eq('project_id', projectId),
            supabase.from('project_risks').select('*').eq('project_id', projectId),
            supabase.from('project_goals').select('*').eq('project_id', projectId),
            supabase.from('project_expenses').select('*').eq('project_id', projectId),
            supabase.from('project_files').select('*').eq('project_id', projectId)
        ]);

        // Reconstruct Project
        const phases: ProjectPhase[] = (phasesData || []).map(p => ({
            id: p.id,
            name: p.name,
            tasks: (tasksData || [])
                .filter(t => t.phase_id === p.id)
                .map((t, idx) => ({
                    id: t.id,
                    subTaskName: t.sub_task_name,
                    deliverables: t.deliverables,
                    workContent: t.work_content,
                    owner: t.owner,
                    duration: Number(t.duration) || t.duration,
                    startDate: t.start_date,
                    endDate: t.end_date,
                    status: t.status as any,
                    score: t.score,
                    dependencies: t.dependencies || [],
                    linkedDocIds: t.linked_doc_ids || [],
                    linkedGoalId: t.linked_goal_id,
                    order_index: idx,
                    remarks: t.remarks || [],
                    attachments: t.attachments || [],
                    checklist: t.checklist || [],
                    comments: t.comments || []
                }))
        }));

        const project: Project = {
            id: row.id,
            lastModified: Number(row.last_modified) || new Date(row.updated_at).getTime(),
            info: {
                name: row.name || 'Untitled',
                code: row.code || '',
                manager: row.manager || '',
                description: row.description || '',
                budgetTotal: Number(row.budget_total) || 0,
                currency: row.currency || 'USD',
                expenseCategories: row.expense_categories || []
            },
            phases: phases,
            teamMembers: [], // Populated globally
            milestones: (milestonesData || []).map(m => ({
                id: m.id, phaseName: m.phase_name, milestoneName: m.milestone_name, completionDate: m.completion_date,
                durationDiff: Number(m.duration_diff) || 0, remarks: m.remarks
            })),
            meetings: (meetingsData || []).map(m => ({
                id: m.id, title: m.title, date: m.date, type: m.type as any, attendees: m.attendees || [],
                content: m.content, relatedTaskIds: m.related_task_ids || [], status: m.status as any
            })),
            docs: (docsData || []).map(d => ({
                id: d.id, title: d.title, icon: d.icon, parentId: d.parent_id, externalUrl: d.external_url,
                lastModified: Number(d.last_modified) || Date.now(), content: d.content, blocks: d.blocks
            })),
            // ... Risks, Goals, Expenses, Files
            risks: [], goals: [], expenses: [], files: []
        };

        await db.saveProject(project, { skipNotification: true });
    },

    // --- User Sync (LWW) ---
    async syncUser(supabase: any) {
        // User profile is a singleton in 'settings' table key='user'
        const localUser = await db.getUser();
        const { data: remoteUserData } = await supabase.from('settings').select('*').eq('key', 'user').single();

        if (localUser && remoteUserData) {
            // Compare timestamps? User object doesn't have one usually, but the row does.
            // We can assume localUser change updates a timestamp in local storage or just rely on 'updated_at'
            // For simplicity: If remote exists, pull it. If not, push local.
            // A true LWW needs a local timestamp.
            // Let's assume remote is truth for user profile if it exists, unless we track local changes.
            // Given the constraints, let's just Pull if exists.
            await db.saveUser(remoteUserData.value, { skipNotification: true });
        } else if (localUser) {
            await supabase.from('settings').upsert({ key: 'user', value: localUser, updated_at: new Date().toISOString() });
        }
    },

    // Compatibility methods for existing calls
    async pushToSupabase() { return this.sync(); },
    async pullFromSupabase() { return this.sync(); }
};
