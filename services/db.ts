
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Project, TeamMember } from '../types';

interface GenPMDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  settings: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'gen-pm-db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<GenPMDB>>;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<GenPMDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      },
    });
  }
  return dbPromise;
};

type DBListener = (type: 'project' | 'team' | 'user' | 'tags', data?: any) => void;
const listeners: DBListener[] = [];

export const db = {
  subscribe(listener: DBListener) {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  },

  notify(type: 'project' | 'team' | 'user', data?: any) {
    listeners.forEach(l => l(type, data));
  },

  async init() {
    const database = await getDB();

    // --- Data Migration Logic ---
    const projectCount = await database.count('projects');

    // If DB is empty, check LocalStorage for legacy data
    if (projectCount === 0) {
      const lsProjects = localStorage.getItem('gen_pm_projects');
      if (lsProjects) {
        try {
          const projects: Project[] = JSON.parse(lsProjects);
          if (Array.isArray(projects) && projects.length > 0) {
            const tx = database.transaction('projects', 'readwrite');
            for (const p of projects) {
              await tx.store.put(p);
            }
            await tx.done;
            console.log("Migrated projects from LocalStorage to IndexedDB");
          }
        } catch (e) {
          console.error("Migration failed for projects", e);
        }
      }
    }

    // Migrate Settings (Team & User)
    const keys = ['gen_pm_global_team', 'gen_pm_user'];
    const settingsMap: Record<string, string> = {
      'gen_pm_global_team': 'team',
      'gen_pm_user': 'user'
    };

    for (const lsKey of keys) {
      const val = localStorage.getItem(lsKey);
      if (val) {
        const dbKey = settingsMap[lsKey];
        const existing = await database.get('settings', dbKey);
        if (!existing) {
          try {
            await database.put('settings', JSON.parse(val), dbKey);
            console.log(`Migrated ${dbKey} from LocalStorage`);
          } catch (e) { console.error(`Migration failed for ${dbKey}`, e); }
        }
      }
    }
  },

  // --- Projects ---
  async getAllProjects(): Promise<Project[]> {
    return (await getDB()).getAll('projects');
  },

  async saveProject(project: Project, options?: { skipNotification?: boolean }) {
    const database = await getDB();
    const result = await database.put('projects', project);

    // Backup to LocalStorage (Safety Net)
    try {
      const allProjects = await database.getAll('projects');
      localStorage.setItem('gen_pm_projects_backup', JSON.stringify(allProjects));
    } catch (e) {
      console.warn("Backup to LocalStorage failed (quota exceeded?)", e);
    }

    if (!options?.skipNotification) {
      this.notify('project', project);
    }
    return result;
  },

  async deleteProject(id: string) {
    return (await getDB()).delete('projects', id);
  },

  // --- Team ---
  async getTeam(): Promise<TeamMember[] | undefined> {
    return (await getDB()).get('settings', 'team');
  },

  async saveTeam(team: TeamMember[], options?: { skipNotification?: boolean }) {
    const result = await (await getDB()).put('settings', team, 'team');
    if (!options?.skipNotification) {
      this.notify('team', team);
    }
    return result;
  },

  // --- User Profile ---
  async getUser(): Promise<any> {
    return (await getDB()).get('settings', 'user');
  },

  async saveUser(user: any, options?: { skipNotification?: boolean }) {
    const result = await (await getDB()).put('settings', user, 'user');
    if (!options?.skipNotification) {
      this.notify('user', user);
    }
    return result;
  },

  // --- Tags ---
  async getTags(): Promise<Record<string, string[]> | undefined> {
    return (await getDB()).get('settings', 'tags');
  },

  async saveTags(tags: Record<string, string[]>, options?: { skipNotification?: boolean }) {
    const result = await (await getDB()).put('settings', tags, 'tags');
    if (!options?.skipNotification) {
      this.notify('tags', tags); // Note: You might need to update DBListener type
    }
    return result;
  },

  // --- Utilities ---
  async clearAll() {
    const database = await getDB();
    await database.clear('projects');
    await database.clear('settings');
  },

  async exportData() {
    const database = await getDB();
    const projects = await database.getAll('projects');
    const team = await database.get('settings', 'team');
    const user = await database.get('settings', 'user');
    // Also include density from LS if exists
    const density = localStorage.getItem('gen_pm_density');
    const aiConfig = localStorage.getItem('project_ai_config');

    return {
      projects,
      team,
      user,
      density,
      aiConfig: aiConfig ? JSON.parse(aiConfig) : undefined,
      timestamp: Date.now(),
      version: 1
    };
  },

  async importData(data: any) {
    const database = await getDB();

    if (Array.isArray(data.projects)) {
      const tx = database.transaction('projects', 'readwrite');
      await tx.store.clear(); // Clear existing to replace
      for (const p of data.projects) {
        await tx.store.put(p);
      }
      await tx.done;
    }

    if (data.team) await database.put('settings', data.team, 'team');
    if (data.user) await database.put('settings', data.user, 'user');

    if (data.density) localStorage.setItem('gen_pm_density', data.density);
    if (data.aiConfig) localStorage.setItem('project_ai_config', JSON.stringify(data.aiConfig));
  }
};
