import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("/logout", "routes/logout.tsx"),

  route("/forms", "routes/forms.tsx", [
    route(":formId", "routes/forms.$formId.tsx", []),
  ]),
  route("settings/notifications", "routes/settings.notifications.tsx"),
  route("settings/notifications/test", "routes/settings.notifications.test.tsx"),
] satisfies RouteConfig;
