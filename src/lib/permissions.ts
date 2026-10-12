/**
 * Identificadores das permissões (iguais ao catálogo do backend:
 * nestjs-api/src/modules/access-control/domain/permission-catalog.ts).
 * Servem só para esconder menus/acções — quem decide é sempre o backend.
 * Nunca são mostrados ao utilizador.
 */
export const P = {
  DASHBOARD_VIEW: "dashboard_view_permission",
  DEBTOR_VIEW: "debtor_view_permission",
  DEBTOR_CREATE: "debtor_create_permission",
  INVOICE_VIEW: "invoice_view_permission",
  INVOICE_CREATE: "invoice_create_permission",
  INVOICE_UPDATE: "invoice_update_permission",
  DISPUTE_VIEW: "invoice_dispute_view_permission",
  PROCESS_VIEW: "process_view_permission",
  WALLET_VIEW: "wallet_view_permission",
  NEGOTIATION_VIEW: "negotiation_view_permission",
  NEGOTIATION_CREATE: "negotiation_create_permission",
  PAYMENT_VIEW: "payment_view_permission",
  PAYMENT_REGISTER: "payment_register_permission",
  PAYMENT_METHOD_MANAGE: "payment_method_manage_permission",
  ORGANIZATION_VIEW: "organization_view_permission",
  ORGANIZATION_MANAGE: "organization_manage_permission",
  CREDITOR_ACCOUNT_VIEW: "creditor_account_view_permission",
  LADDER_VIEW: "collection_ladder_view_permission",
  POLICY_MANAGE: "collection_policy_manage_permission",
  USER_VIEW: "user_view_permission",
  USER_CREATE: "user_create_permission",
  ROLE_VIEW: "role_view_permission",
  ROLE_MANAGE: "role_manage_permission",
  CATALOG_MANAGE: "catalog_manage_permission",
  AUDIT_VIEW: "audit_view_permission",
  IMPORT_HISTORY_VIEW: "import_history_view_permission",
  REPORTS_VIEW: "reports_view_permission",
  REPORTS_COST_MANAGE: "reports_cost_manage_permission",
  OUTBOX_MANAGE: "outbox_manage_permission",
  INTEGRATION_VIEW: "integration_view_permission",
  INTEGRATION_MANAGE: "integration_manage_permission",
  INTEGRATION_REVIEW: "integration_review_permission",
} as const;

export const SUPER_ADMIN_ROLE = "super-admin";
