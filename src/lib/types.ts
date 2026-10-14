export interface TagRef {
  assignmentId: string;
  tagId: string;
  name: string;
  color: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
  _count?: { assignments: number };
}

export interface Workspace {
  id: string;
  drataId: string;
  name: string;
  isPrimary: boolean;
}

export type Status = "PASS" | "FAIL" | null;

export interface ControlListItem {
  id: string;
  code: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  isReady: boolean;
  hasPolicy: boolean;
  hasPassingTest: boolean;
  hasEvidence: boolean;
  testCount: number;
  tags: TagRef[];
  status: Status;
  reasonCode: string | null;
  reasonDetail: string | null;
}

export interface TestListItem {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  checkResultStatus: string | null;
  checkStatus: string | null;
  source: string | null;
  provider: string | null;
  controls: { id: string; code: string; name: string }[];
  tags: TagRef[];
  status: Status;
}

export interface ControlDetail extends Omit<ControlListItem, "testCount"> {
  description: string | null;
  tests: {
    id: string;
    name: string;
    checkResultStatus: string | null;
    checkStatus: string | null;
    status: Status;
    tags: TagRef[];
  }[];
  evidence: { id: string; name: string; status: string; renewalDate: string | null }[];
}
