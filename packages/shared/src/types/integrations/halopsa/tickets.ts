export type HaloPSANewTicket = {
  siteId: number;
  clientId: number;
  summary: string;
  details: string;
  user: {
    name: string;
    email: string;
    phone: string;
  };
  impact: string;
  urgency: string;
  assets: number[];
  images: string[];
};

export interface HaloPriority {
  id: string;
  slaid: number;
  priorityid: number;
  name: string;
  fixtime: number;
  fixunits: string;
  enterslaexcuse: boolean;
  responsetime: number;
  responseunits: string;
  ishidden: boolean;
  fixendofday: boolean;
  responseendofday: boolean;
  colour: string;
  workdaysoverride: number;
  responsestartofday: boolean;
  responsestartofdaytime: string;
  startofday: boolean;
  startofdaytime: string;
  setfixtostartdate: boolean;
  setfixtotargetdate: boolean;
  firstresponsetime: number;
  firstresponseunits: string;
}

export interface HaloSite {
  id: number;
  name: string;
  client_id: number;
  client_name: string;
  clientsite_name: string;
  inactive: boolean;
  sla_id: number;
  colour: string;
  timezone: string;
  // ... plus the rest
}

export interface HaloUser {
  id: number;
  name: string;
  site_id: number;
  site_name: string;
  client_name: string;
  firstname: string;
  surname: string;
  inactive: boolean;
  colour: string;
  isimportantcontact: boolean;
  customfields: any[];
  site: HaloSite;
  // ... plus the rest
}

export interface HaloExtraAction {
  ticket_id: number;
  id: number;
  outcome: string;
  who: string;
  who_type: number;
  who_agentid: number;
  datetime: string;
  note: string;
  replied_to_ticket_id: number;
  // ... trimmed, same approach
}

export interface HaloTicketType {
  id: number;
  guid: string;
  name: string;
  use: string;
  sequence: number;
  group_id: number;
  group_name: string;
  // ... keep what you need
}

export interface HaloPSATicket {
  id: number;
  dateoccurred: string;
  summary: string;
  details: string;
  status_id: number;
  tickettype_id: number;
  sla_id: number;
  sla_name: string;
  priority_id: number;
  priority: HaloPriority;
  client_id: number;
  client_name: string;
  site_id: number;
  site_name: string;
  user_id: number;
  user_name: string;
  team_id: number;
  team: string;
  agent_id: number;
  category_1: string;
  category_2: string;
  category_3: string;
  category_4: string;
  categoryid_1: number;
  estimate: number;
  estimatedays: number;
  child_count: number;
  attachment_count: number;
  flagged: boolean;
  read: boolean;
  enduserstatus: number;
  onhold: boolean;
  respondbydate: string;
  fixbydate: string;
  excludefromsla: boolean;
  slaholdtime: number;
  site_timezone: string;
  slaactiondate: string;
  slapercused: number;
  slatimeleft: number;
  currentelapsedhours: number;
  lastactiondate: string;
  last_update: string;
  organisation_id: number;
  department_id: number;
  matched_kb_id: number;
  product_id: number;
  // ... (all the rest of the scalar props)
  user: HaloUser;
  tickettype: HaloTicketType;
  extra_actions: HaloExtraAction[];
  attachments: any[];
  // keep extending as needed
}
