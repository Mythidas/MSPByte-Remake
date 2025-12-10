export type MSGraphRole = {
  id: string;
  displayName: string;
  description: string;
  roleTemplateId: string; // GUID that maps to the built-in role template
};

export type M365NormalRole = {
  id: string;
  roleTemplateId: string;
  displayName: string;
  description: string;
  members: string[];
  deletedDateTime: string;
}