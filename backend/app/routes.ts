import { type RouteConfig, index, route, layout, prefix } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Auth
  route("api/auth/login", "routes/api/auth.login.ts"),
  route("api/auth/logout", "routes/api/auth.logout.ts"),
  route("api/auth/me", "routes/api/auth.me.ts"),
  route("api/auth/change-password", "routes/api/auth.change-password.ts"),
  
  // Users
  route("api/users", "routes/api/users.ts"),
  route("api/users/:id", "routes/api/users.$id.ts"),

  // User Types
  route("api/user-types", "routes/api/user-types.ts"),

  // Machines
  route("api/machines", "routes/api/machines.ts"),
  route("api/machines/:id", "routes/api/machines.$id.ts"),
  route("api/machines/:id/mode-status", "routes/api/machines.$id.mode-status.ts"),
  route("api/machines/:id/activate-full-mode", "routes/api/machines.$id.activate-full-mode.ts"),
  route("api/machines/:id/extend-demo", "routes/api/machines.$id.extend-demo.ts"),
  route("api/machines/:id/reset-demo", "routes/api/machines.$id.reset-demo.ts"),

  // Invoices
  route("api/invoices", "routes/api/invoices.ts"),
  route("api/invoices/:id/payment", "routes/api/invoices.$id.payment.ts"),
  
  // Therapists
  route("api/therapists", "routes/api/therapists.ts"),
  
  // Patients
  route("api/patients", "routes/api/patients.ts"),

  // Sessions
  route("api/sessions", "routes/api/sessions.ts"),
  route("api/sessions/bulk-sync", "routes/api/sessions.bulk-sync.ts"),

  // Settings
  route("api/settings/:id", "routes/api/settings.$id.ts"),

  // Resources
  route("api/resources", "routes/api/resources.ts"),
  route("api/resources/:id", "routes/api/resources.$id.ts"),

  ...prefix("supplier", [
    route("login", "routes/supplier.login.tsx"),
    route("logout", "routes/supplier.logout.tsx"),
    layout("routes/supplier.tsx", [
      index("routes/supplier._index.tsx"),
      route("owners", "routes/supplier.owners.tsx"),
      route("owners/:id", "routes/supplier.owners.$id.tsx"),
      route("machines", "routes/supplier.machines.tsx"),
      route("machines/:id", "routes/supplier.machines.$id.tsx"),
      route("invoices", "routes/supplier.invoices.tsx"),
      route("resources", "routes/supplier.resources.tsx"),
    ])
  ]),

  ...prefix("admin", [
    route("login", "routes/admin.login.tsx"),
    route("logout", "routes/admin.logout.tsx"),
    layout("routes/admin.tsx", [
      index("routes/admin._index.tsx"),
      route("machines", "routes/admin.machines.tsx"),
      route("users", "routes/admin.users.tsx"),
      route("owners", "routes/admin.owners.tsx"),
      route("suppliers", "routes/admin.suppliers.tsx"),
      route("invoices", "routes/admin.invoices.tsx"),
      route("resources", "routes/admin.resources.tsx")
    ])
  ])
] satisfies RouteConfig;
