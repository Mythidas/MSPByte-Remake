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
