import { Company } from "@workspace/shared/types/database/normalized";
import { AutoTaskCompany } from "@workspace/shared/types/source/autotask/company.js";

export default class CompanyNormalizer {
  static normalize(integration: string, data: any[]): Company[] {
    switch (integration) {
      case "autotask": {
        return this.fromAutoTask(data);
      }
      default:
        return [];
    }
  }

  private static fromAutoTask(companies: AutoTaskCompany[]) {
    return companies.map((company) => {
      return {
        external_id: String(company.id),
        name: company.companyName,
        address: company.address1,
        type: company.companyType === 1 ? "customer" : "prospect",

        created_at: company.createDate,
      } as Company;
    });
  }
}
