export interface AsanaTask {
  gid: string;
  name: string;
  completed: boolean;
  due_on?: string;
  assignee?: { gid: string; name: string };
  notes?: string;
  projects?: { gid: string; name: string }[];
}

export interface AsanaProject {
  gid: string;
  name: string;
}

export interface AsanaWorkspace {
  gid: string;
  name: string;
}
