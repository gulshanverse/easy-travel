/**
 * TIE — Server-function surface. Client-safe module.
 * Every function is authenticated via requireSupabaseAuth. Handlers
 * dynamically import server-only modules to keep them out of the client bundle.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CollaboratorRole, ExportFormat, JourneyState, RecommendationSubject } from "./types";

// ------- Journey -------

const createTripSchema = z.object({
  title: z.string().min(1).max(200),
  summary: z.string().max(2000).optional().nullable(),
  startDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  endDate: z.string().datetime().or(z.string().date()).optional().nullable(),
  currency: z.string().length(3).optional(),
  budgetTotalCents: z.number().int().nonnegative().optional().nullable(),
  primaryDestinationId: z.string().uuid().optional().nullable(),
  originCityId: z.string().uuid().optional().nullable(),
  travelerCount: z.number().int().min(1).max(50).optional(),
  pace: z.enum(["relaxed", "balanced", "intense"]).optional(),
  visibility: z.enum(["private", "unlisted", "public"]).optional(),
  tags: z.array(z.string()).optional(),
});

export const createTripFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createTripSchema>) => createTripSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { createTIE } = await import("./orchestrator.server");
    const tie = createTIE({ supabase: context.supabase, userId: context.userId });
    return tie.createJourney(data);
  });

export const listTripsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { JourneyService } = await import("./journey.server");
    return new JourneyService(context.supabase, context.userId).list();
  });

const tripIdSchema = z.object({ tripId: z.string().uuid() });

export const getTripFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof tripIdSchema>) => tripIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { createTIE } = await import("./orchestrator.server");
    return createTIE({ supabase: context.supabase, userId: context.userId }).fullTripSnapshot(data.tripId);
  });

const advanceSchema = z.object({
  tripId: z.string().uuid(),
  next: z.enum(["draft", "planning", "ready", "booked", "traveling", "completed", "archived", "cancelled"] as [JourneyState, ...JourneyState[]]),
});

export const advanceTripFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof advanceSchema>) => advanceSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { createTIE } = await import("./orchestrator.server");
    return createTIE({ supabase: context.supabase, userId: context.userId }).advance(data.tripId, data.next);
  });

export const cloneTripFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof tripIdSchema>) => tripIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { JourneyService } = await import("./journey.server");
    return new JourneyService(context.supabase, context.userId).clone(data.tripId);
  });

// ------- Timeline -------

export const buildTimelineFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof tripIdSchema>) => tripIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { TimelineService } = await import("./timeline.server");
    return new TimelineService(context.supabase).build(data.tripId);
  });

const moveActivitySchema = z.object({
  activityId: z.string().uuid(),
  dayId: z.string().uuid().nullable(),
  position: z.number().int().min(1),
});

export const moveActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof moveActivitySchema>) => moveActivitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { TimelineService } = await import("./timeline.server");
    return new TimelineService(context.supabase).moveActivity(data.activityId, {
      dayId: data.dayId,
      position: data.position,
    });
  });

// ------- Activities -------

const createActivitySchema = z.object({
  tripId: z.string().uuid(),
  tripDayId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  activityType: z
    .enum([
      "flight",
      "train",
      "bus",
      "cab",
      "transfer",
      "hotel",
      "checkin",
      "checkout",
      "restaurant",
      "experience",
      "sightseeing",
      "custom",
    ])
    .optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  durationMin: z.number().int().nonnegative().nullable().optional(),
  costCents: z.number().int().nonnegative().nullable().optional(),
  currency: z.string().length(3).optional(),
  notes: z.string().max(4000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const createActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof createActivitySchema>) => createActivitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { ActivityService } = await import("./activity.server");
    return new ActivityService(context.supabase).create(data);
  });

const removeActivitySchema = z.object({ activityId: z.string().uuid() });

export const removeActivityFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof removeActivitySchema>) => removeActivitySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { ActivityService } = await import("./activity.server");
    return new ActivityService(context.supabase).remove(data.activityId);
  });

// ------- Budget -------

export const budgetSummaryFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof tripIdSchema>) => tripIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { BudgetService } = await import("./budget.server");
    return new BudgetService(context.supabase).summarize(data.tripId);
  });

const setBudgetSchema = z.object({
  tripId: z.string().uuid(),
  budgetCents: z.number().int().nonnegative().nullable(),
  currency: z.string().length(3).optional(),
});

export const setBudgetFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof setBudgetSchema>) => setBudgetSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { BudgetService } = await import("./budget.server");
    return new BudgetService(context.supabase).setBudget(data.tripId, data.budgetCents, data.currency);
  });

// ------- Recommendations -------

const listRecsSchema = z.object({
  subjectKind: z
    .enum(["trip", "day", "activity", "place", "hotel", "restaurant", "experience", "flight", "budget", "packing"])
    .optional() as z.ZodOptional<z.ZodType<RecommendationSubject>>,
});

export const listRecommendationsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof listRecsSchema>) => listRecsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { RecommendationService } = await import("./recommendation.server");
    return new RecommendationService(context.supabase).list(context.userId, data.subjectKind);
  });

const dismissRecSchema = z.object({ id: z.string().uuid() });
export const dismissRecommendationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof dismissRecSchema>) => dismissRecSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { RecommendationService } = await import("./recommendation.server");
    return new RecommendationService(context.supabase).dismiss(data.id, context.userId);
  });

// ------- Collaboration -------

const inviteCollabSchema = z.object({
  tripId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(["owner", "editor", "commenter", "viewer"] as [CollaboratorRole, ...CollaboratorRole[]]).default("viewer"),
});

export const inviteCollaboratorFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof inviteCollabSchema>) => inviteCollabSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { CollaborationService } = await import("./collaboration.server");
    return new CollaborationService(context.supabase).invite(data.tripId, data.userId, data.role);
  });

// ------- Version -------

export const listVersionsFn = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof tripIdSchema>) => tripIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { VersionService } = await import("./version.server");
    return new VersionService(context.supabase).list(data.tripId);
  });

const rollbackSchema = z.object({ tripId: z.string().uuid(), version: z.number().int().positive() });
export const rollbackVersionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof rollbackSchema>) => rollbackSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { VersionService } = await import("./version.server");
    return new VersionService(context.supabase).rollback(data.tripId, data.version, context.userId);
  });

// ------- Export -------

const exportSchema = z.object({
  tripId: z.string().uuid(),
  format: z.enum(["pdf", "ics", "json", "share-link", "offline"] as [ExportFormat, ...ExportFormat[]]),
  baseUrl: z.string().url().optional(),
});

export const exportTripFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: z.input<typeof exportSchema>) => exportSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { ExportService } = await import("./export.server");
    return new ExportService(context.supabase).export(data.tripId, data.format, data.baseUrl);
  });
