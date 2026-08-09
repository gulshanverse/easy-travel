/**
 * NCP — built-in template catalog (English + a Hindi locale sample).
 * Content is product copy only; no provider markup, no vendor tags.
 */
import { makeTemplate, type NotificationTemplate } from "./templates";

export const BUILT_IN_TEMPLATES: readonly NotificationTemplate[] = Object.freeze([
  makeTemplate({
    id: "security.login_alert",
    category: "security",
    requiredVariables: ["device", "city"],
    channels: {
      in_app: {
        subject: "New sign-in",
        body: "A new sign-in from {{device}} in {{city}}.",
        summary: "New sign-in from {{city}}",
      },
      email: {
        subject: "New sign-in to your Easy Trip account",
        body: "We noticed a sign-in from {{device}} in {{city}}. If this wasn't you, secure your account.",
      },
      push: { body: "New sign-in from {{city}}" },
      sms: { body: "Easy Trip: new sign-in from {{city}}." },
    },
  }),
  makeTemplate({
    id: "booking.confirmed",
    category: "booking",
    requiredVariables: ["reference", "destination"],
    channels: {
      in_app: {
        subject: "Booking confirmed",
        body: "Your trip to {{destination}} is confirmed. Reference {{reference}}.",
        summary: "{{destination}} confirmed",
      },
      email: {
        subject: "Your trip to {{destination}} is confirmed",
        body: "Everything is set for {{destination}}. Your reference is {{reference}}.",
      },
      push: { body: "{{destination}} is confirmed" },
    },
  }),
  makeTemplate({
    id: "journey.delay_alert",
    category: "delay",
    requiredVariables: ["service", "minutes"],
    channels: {
      in_app: {
        subject: "Delay",
        body: "{{service}} is running {{minutes}} minutes late.",
        summary: "{{service}} delayed",
      },
      push: { body: "{{service}} delayed {{minutes}} min" },
      sms: { body: "Easy Trip: {{service}} delayed {{minutes}} min." },
    },
  }),
  makeTemplate({
    id: "journey.price_drop",
    category: "price",
    requiredVariables: ["route", "price"],
    channels: {
      in_app: {
        subject: "Price drop",
        body: "{{route}} just dropped to {{price}}.",
        summary: "{{route}} price drop",
      },
      email: {
        subject: "Price drop on {{route}}",
        body: "{{route}} is now {{price}}. Prices move quickly.",
      },
      push: { body: "{{route}} now {{price}}" },
    },
  }),
  makeTemplate({
    id: "journey.reminder",
    category: "reminder",
    requiredVariables: ["title", "when"],
    channels: {
      in_app: { subject: "Reminder", body: "{{title}} — {{when}}.", summary: "{{title}}" },
      email: { subject: "Reminder: {{title}}", body: "{{title}} is coming up {{when}}." },
      push: { body: "{{title}} — {{when}}" },
    },
  }),
  makeTemplate({
    id: "workflow.status",
    category: "workflow",
    requiredVariables: ["workflow", "status"],
    channels: {
      in_app: {
        subject: "Workflow update",
        body: "{{workflow}} is now {{status}}.",
        summary: "{{workflow}}: {{status}}",
      },
    },
  }),
  makeTemplate({
    id: "agent.suggestion",
    category: "agent",
    requiredVariables: ["headline"],
    channels: {
      in_app: { subject: "A thought for your trip", body: "{{headline}}", summary: "{{headline}}" },
      push: { body: "{{headline}}" },
    },
  }),
  makeTemplate({
    id: "system.digest",
    category: "system",
    requiredVariables: ["count"],
    channels: {
      in_app: {
        subject: "Your updates",
        body: "You have {{count}} new updates.",
        summary: "{{count}} updates",
      },
      email: { subject: "Your Easy Trip digest", body: "You have {{count}} new updates waiting." },
    },
  }),
  makeTemplate({
    id: "security.login_alert",
    category: "security",
    locale: "hi",
    requiredVariables: ["device", "city"],
    channels: {
      in_app: {
        subject: "नया साइन-इन",
        body: "{{city}} में {{device}} से नया साइन-इन हुआ।",
        summary: "{{city}} से नया साइन-इन",
      },
      email: {
        subject: "आपके Easy Trip खाते में नया साइन-इन",
        body: "{{city}} में {{device}} से साइन-इन देखा गया।",
      },
    },
  }),
]);
