
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
  // ERP Stores
  erp_datasets: {
    key: string;
    value: any;
  };
  erp_products: {
    key: string;
    value: any;
  };
  erp_templates: {
    key: string;
    value: any;
  };
  erp_state: {
    key: string;
    value: any;
  };
}

const DB_NAME = 'gen-pm-db';
const DB_VERSION = 2; // Increment version for new stores

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
        // --- ERP Stores ---
        if (!db.objectStoreNames.contains('erp_datasets')) {
          db.createObjectStore('erp_datasets', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('erp_products')) {
          db.createObjectStore('erp_products', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('erp_templates')) {
          db.createObjectStore('erp_templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('erp_state')) {
          db.createObjectStore('erp_state');
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

  // --- ERP Data Managers ---
  async getERPDatasets() {
    return (await getDB()).getAll('erp_datasets');
  },
  async saveERPDataset(dataset: any) {
    return (await getDB()).put('erp_datasets', dataset);
  },
  async deleteERPDataset(id: string) {
    return (await getDB()).delete('erp_datasets', id);
  },

  async getERPProducts() {
    return (await getDB()).getAll('erp_products');
  },
  async saveERPProduct(product: any) {
    return (await getDB()).put('erp_products', product);
  },
  async deleteERPProduct(id: string) {
    return (await getDB()).delete('erp_products', id);
  },

  async getERPTemplates() {
    return (await getDB()).getAll('erp_templates');
  },
  async saveERPTemplate(template: any) {
    return (await getDB()).put('erp_templates', template);
  },
  async deleteERPTemplate(id: string) {
    return (await getDB()).delete('erp_templates', id);
  },

  // ERP Global State (Records, Schema, etc.)
  async getERPState(key: string) {
    return (await getDB()).get('erp_state', key);
  },
  async saveERPState(key: string, value: any) {
    return (await getDB()).put('erp_state', value, key);
  },

  // --- Utilities ---
  async clearAll() {
    const database = await getDB();
    await database.clear('projects');
    await database.clear('settings');
    if (database.objectStoreNames.contains('erp_datasets')) await database.clear('erp_datasets');
    if (database.objectStoreNames.contains('erp_products')) await database.clear('erp_products');
    if (database.objectStoreNames.contains('erp_templates')) await database.clear('erp_templates');
    if (database.objectStoreNames.contains('erp_state')) await database.clear('erp_state');
  },

  async exportData() {
    const database = await getDB();
    const projects = await database.getAll('projects');
    const team = await database.get('settings', 'team');
    const user = await database.get('settings', 'user');
    const tags = await database.get('settings', 'tags');

    // ERP Data
    let erpDatasets: any[] = [];
    if (database.objectStoreNames.contains('erp_datasets')) {
      erpDatasets = await database.getAll('erp_datasets');
    }

    let erpProducts: any[] = [];
    if (database.objectStoreNames.contains('erp_products')) {
      erpProducts = await database.getAll('erp_products');
    }

    let erpTemplates: any[] = [];
    if (database.objectStoreNames.contains('erp_templates')) {
      erpTemplates = await database.getAll('erp_templates');
    }

    // ERP State (Key-Value Store)
    let erpStateData: { key: IDBValidKey; value: any }[] = [];
    if (database.objectStoreNames.contains('erp_state')) {
      const keys = await database.getAllKeys('erp_state');
      const values = await database.getAll('erp_state');
      erpStateData = keys.map((k, i) => ({ key: k, value: values[i] }));
    }

    // LocalStorage Data
    const density = localStorage.getItem('gen_pm_density');
    const aiConfig = localStorage.getItem('project_ai_config');

    return {
      projects,
      team,
      user,
      tags,
      erpDatasets,
      erpProducts,
      erpTemplates,
      erpState: erpStateData,
      density,
      aiConfig: aiConfig ? JSON.parse(aiConfig) : undefined,
      timestamp: Date.now(),
      version: 2
    };
  },

  async importData(data: any) {
    const database = await getDB();

    // 1. Projects
    if (Array.isArray(data.projects)) {
      const tx = database.transaction('projects', 'readwrite');
      await tx.store.clear();
      for (const p of data.projects) {
        await tx.store.put(p);
      }
      await tx.done;
    }

    // 2. Settings (Team, User, Tags)
    if (data.team) await database.put('settings', data.team, 'team');
    if (data.user) await database.put('settings', data.user, 'user');
    if (data.tags) await database.put('settings', data.tags, 'tags');

    // 3. ERP Data
    if (Array.isArray(data.erpDatasets) && database.objectStoreNames.contains('erp_datasets')) {
      const tx = database.transaction('erp_datasets', 'readwrite');
      await tx.store.clear();
      for (const item of data.erpDatasets) await tx.store.put(item);
      await tx.done;
    }

    if (Array.isArray(data.erpProducts) && database.objectStoreNames.contains('erp_products')) {
      const tx = database.transaction('erp_products', 'readwrite');
      await tx.store.clear();
      for (const item of data.erpProducts) await tx.store.put(item);
      await tx.done;
    }

    if (Array.isArray(data.erpTemplates) && database.objectStoreNames.contains('erp_templates')) {
      const tx = database.transaction('erp_templates', 'readwrite');
      await tx.store.clear();
      for (const item of data.erpTemplates) await tx.store.put(item);
      await tx.done;
    }

    if (Array.isArray(data.erpState) && database.objectStoreNames.contains('erp_state')) {
      const tx = database.transaction('erp_state', 'readwrite');
      await tx.store.clear();
      for (const item of data.erpState) {
        await tx.store.put(item.value, item.key);
      }
      await tx.done;
    }

    // 4. LocalStorage
    if (data.density) localStorage.setItem('gen_pm_density', data.density);
    if (data.aiConfig) localStorage.setItem('project_ai_config', JSON.stringify(data.aiConfig));
  }
};
