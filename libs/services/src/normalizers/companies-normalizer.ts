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
        external_parent_id: String(company.parentCompanyID),

        name: company.companyName,
        type: company.companyType === 1 ? "customer" : "prospect",
        address: company.address1,

        created_at: company.createDate,
      } as Company;
    });
  }
}
