export type AppUser = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "ceo" | "manager" | "employee" | "bod" | "bod_viewer";
  department_id: string | null;
  position: string | null;
  contract_type: string | null;
  base_salary: number;
  insurance_salary: number;
  max_bonus: number;
  dependent_count: number;
  active?: boolean;
  terminated_at?: string | null;
  termination_reason?: string | null;
};
