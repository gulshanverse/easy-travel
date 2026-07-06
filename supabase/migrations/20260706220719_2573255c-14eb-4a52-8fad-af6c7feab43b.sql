
CREATE TYPE public.trip_status AS ENUM ('draft','planning','confirmed','in_progress','completed','cancelled','archived');
CREATE TYPE public.trip_visibility AS ENUM ('private','unlisted','public');
CREATE TYPE public.trip_pace AS ENUM ('relaxed','balanced','packed');
CREATE TYPE public.activity_type AS ENUM ('flight','transit','lodging','meal','attraction','experience','free_time','note','other');
CREATE TYPE public.place_kind AS ENUM ('attraction','landmark','museum','park','beach','nightlife','shopping','viewpoint','activity','other');
CREATE TYPE public.booking_type AS ENUM ('flight','hotel','train','bus','cab','experience','restaurant','package','other');
CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','ticketed','in_progress','completed','cancelled','refunded','failed');
CREATE TYPE public.payment_status AS ENUM ('initiated','authorized','captured','failed','refunded','partially_refunded','chargeback');
CREATE TYPE public.payment_method AS ENUM ('card','upi','wallet','netbanking','bank_transfer','apple_pay','google_pay','paypal','crypto','other');
CREATE TYPE public.ai_role AS ENUM ('system','user','assistant','tool');
CREATE TYPE public.ai_agent AS ENUM ('planner','budget','booking','recommendation','weather','safety','memory','translator','general');
CREATE TYPE public.notification_channel AS ENUM ('in_app','email','push','sms');
CREATE TYPE public.notification_priority AS ENUM ('low','normal','high','critical');
CREATE TYPE public.notification_kind AS ENUM ('trip','booking','payment','ai','support','security','system','marketing');
CREATE TYPE public.email_status AS ENUM ('queued','sending','sent','failed','cancelled');
CREATE TYPE public.push_status AS ENUM ('queued','sending','sent','failed','cancelled');
CREATE TYPE public.ticket_status AS ENUM ('open','pending','on_hold','resolved','closed');
CREATE TYPE public.ticket_priority AS ENUM ('low','normal','high','urgent');
CREATE TYPE public.review_target_kind AS ENUM ('hotel','flight','experience','restaurant','place','trip');
CREATE TYPE public.audit_action AS ENUM ('insert','update','delete','login','logout','role_change','password_change','permission_change','export','impersonate');
CREATE TYPE public.device_platform AS ENUM ('web','ios','android','desktop','other');
CREATE TYPE public.taggable_kind AS ENUM ('trip','place','hotel','experience','restaurant','destination');
CREATE TYPE public.image_owner_kind AS ENUM ('user','trip','place','hotel','experience','restaurant','destination','review');

CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permissions readable" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE TABLE public.role_permissions (
  role public.app_role NOT NULL,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role, permission_id)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Role permissions readable" ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _perm text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role = ur.role
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id AND p.code = _perm
  );
$$;
REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated, service_role;

CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  travel_style text[] NOT NULL DEFAULT '{}',
  cuisines text[] NOT NULL DEFAULT '{}',
  avoid text[] NOT NULL DEFAULT '{}',
  budget_tier text CHECK (budget_tier IN ('budget','mid','premium','luxury')),
  preferred_airlines text[] NOT NULL DEFAULT '{}',
  preferred_hotel_brands text[] NOT NULL DEFAULT '{}',
  seat_preference text CHECK (seat_preference IN ('aisle','window','middle','no_preference')),
  meal_preference text,
  accessibility_needs text[] NOT NULL DEFAULT '{}',
  home_airport text,
  measurement_system text NOT NULL DEFAULT 'metric' CHECK (measurement_system IN ('metric','imperial')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own preferences" ON public.user_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER user_preferences_set_updated_at BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.oauth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  email text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (provider, provider_account_id)
);
CREATE INDEX oauth_accounts_user_idx ON public.oauth_accounts(user_id);
GRANT SELECT ON public.oauth_accounts TO authenticated;
GRANT ALL ON public.oauth_accounts TO service_role;
ALTER TABLE public.oauth_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own oauth accounts" ON public.oauth_accounts FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform public.device_platform NOT NULL,
  name text,
  push_token text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, push_token)
);
CREATE INDEX devices_user_idx ON public.devices(user_id) WHERE revoked_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own devices" ON public.devices FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  ip inet,
  user_agent text,
  location text,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
CREATE INDEX app_sessions_user_active_idx ON public.app_sessions(user_id, last_active_at DESC);
GRANT SELECT ON public.app_sessions TO authenticated;
GRANT ALL ON public.app_sessions TO service_role;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own sessions" ON public.app_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.countries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  iso2 char(2) NOT NULL UNIQUE,
  iso3 char(3) NOT NULL UNIQUE,
  name text NOT NULL,
  continent text,
  currency text,
  phone_code text,
  emoji text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.countries TO anon, authenticated;
GRANT ALL ON public.countries TO service_role;
ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Countries public" ON public.countries FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage countries" ON public.countries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_id, name)
);
CREATE INDEX regions_country_idx ON public.regions(country_id);
GRANT SELECT ON public.regions TO anon, authenticated;
GRANT ALL ON public.regions TO service_role;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Regions public" ON public.regions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage regions" ON public.regions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.cities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id uuid NOT NULL REFERENCES public.countries(id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  lat numeric(9,6),
  lng numeric(9,6),
  timezone text,
  population integer CHECK (population IS NULL OR population >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cities_country_idx ON public.cities(country_id);
CREATE INDEX cities_name_lower_idx ON public.cities(lower(name));
GRANT SELECT ON public.cities TO anon, authenticated;
GRANT ALL ON public.cities TO service_role;
ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cities public" ON public.cities FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage cities" ON public.cities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text,
  description text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  hero_image text,
  featured boolean NOT NULL DEFAULT false,
  best_months smallint[] DEFAULT '{}',
  avg_budget_usd integer CHECK (avg_budget_usd IS NULL OR avg_budget_usd >= 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX destinations_featured_idx ON public.destinations(featured) WHERE featured;
CREATE INDEX destinations_country_idx ON public.destinations(country_id);
GRANT SELECT ON public.destinations TO anon, authenticated;
GRANT ALL ON public.destinations TO service_role;
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Destinations public" ON public.destinations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage destinations" ON public.destinations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER destinations_set_updated_at BEFORE UPDATE ON public.destinations
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  name text NOT NULL,
  kind public.place_kind NOT NULL DEFAULT 'other',
  description text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  lat numeric(9,6),
  lng numeric(9,6),
  address text,
  website text,
  phone text,
  hero_image text,
  rating numeric(3,2) CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  price_tier smallint CHECK (price_tier IS NULL OR (price_tier BETWEEN 1 AND 4)),
  external_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX places_city_idx ON public.places(city_id);
CREATE INDEX places_kind_idx ON public.places(kind);
GRANT SELECT ON public.places TO anon, authenticated;
GRANT ALL ON public.places TO service_role;
ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Places public" ON public.places FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage places" ON public.places FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER places_set_updated_at BEFORE UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  slug text,
  summary text,
  cover_image text,
  status public.trip_status NOT NULL DEFAULT 'draft',
  visibility public.trip_visibility NOT NULL DEFAULT 'private',
  pace public.trip_pace NOT NULL DEFAULT 'balanced',
  start_date date,
  end_date date,
  origin_city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  primary_destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'USD',
  budget_total_cents bigint CHECK (budget_total_cents IS NULL OR budget_total_cents >= 0),
  traveler_count smallint NOT NULL DEFAULT 1 CHECK (traveler_count >= 1),
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);
CREATE INDEX trips_user_status_idx ON public.trips(user_id, status, start_date DESC NULLS LAST) WHERE deleted_at IS NULL;
CREATE INDEX trips_public_idx ON public.trips(visibility, updated_at DESC) WHERE visibility <> 'private' AND deleted_at IS NULL;
CREATE INDEX trips_dest_idx ON public.trips(primary_destination_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trips" ON public.trips FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Public trips visible" ON public.trips FOR SELECT TO authenticated
  USING (visibility = 'public' AND deleted_at IS NULL);
CREATE TRIGGER trips_set_updated_at BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.trip_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_index smallint NOT NULL CHECK (day_index >= 1),
  date date,
  title text,
  summary text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, day_index)
);
CREATE INDEX trip_days_trip_idx ON public.trip_days(trip_id, day_index);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_days TO authenticated;
GRANT ALL ON public.trip_days TO service_role;
ALTER TABLE public.trip_days ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trip days" ON public.trip_days FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));
CREATE TRIGGER trip_days_set_updated_at BEFORE UPDATE ON public.trip_days
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.trip_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  trip_day_id uuid REFERENCES public.trip_days(id) ON DELETE SET NULL,
  activity_type public.activity_type NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text,
  place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  starts_at timestamptz,
  ends_at timestamptz,
  duration_min integer CHECK (duration_min IS NULL OR duration_min >= 0),
  cost_cents bigint CHECK (cost_cents IS NULL OR cost_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  position integer NOT NULL DEFAULT 0,
  booking_item_id uuid,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at)
);
CREATE INDEX trip_activities_day_idx ON public.trip_activities(trip_day_id, position);
CREATE INDEX trip_activities_trip_idx ON public.trip_activities(trip_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_activities TO authenticated;
GRANT ALL ON public.trip_activities TO service_role;
ALTER TABLE public.trip_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trip activities" ON public.trip_activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));
CREATE TRIGGER trip_activities_set_updated_at BEFORE UPDATE ON public.trip_activities
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.itineraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','ai','template','import')),
  ai_conversation_id uuid,
  snapshot jsonb NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, version)
);
CREATE UNIQUE INDEX itineraries_active_idx ON public.itineraries(trip_id) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itineraries TO authenticated;
GRANT ALL ON public.itineraries TO service_role;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own itineraries" ON public.itineraries FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));

CREATE TABLE public.saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CHECK (place_id IS NOT NULL OR destination_id IS NOT NULL)
);
CREATE UNIQUE INDEX saved_places_uniq_idx ON public.saved_places(user_id, COALESCE(place_id, '00000000-0000-0000-0000-000000000000'::uuid), COALESCE(destination_id, '00000000-0000-0000-0000-000000000000'::uuid)) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own saved places" ON public.saved_places FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.wishlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Wishlist',
  description text,
  is_default boolean NOT NULL DEFAULT false,
  visibility public.trip_visibility NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX wishlists_default_idx ON public.wishlists(user_id) WHERE is_default AND deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlists TO authenticated;
GRANT ALL ON public.wishlists TO service_role;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own wishlists" ON public.wishlists FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER wishlists_set_updated_at BEFORE UPDATE ON public.wishlists
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wishlist_id uuid NOT NULL REFERENCES public.wishlists(id) ON DELETE CASCADE,
  destination_id uuid REFERENCES public.destinations(id) ON DELETE SET NULL,
  place_id uuid REFERENCES public.places(id) ON DELETE SET NULL,
  title text,
  note text,
  target_month smallint CHECK (target_month IS NULL OR (target_month BETWEEN 1 AND 12)),
  target_year smallint CHECK (target_year IS NULL OR target_year BETWEEN 2000 AND 2100),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX wishlist_items_wishlist_idx ON public.wishlist_items(wishlist_id, position);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own wishlist items" ON public.wishlist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.wishlists w WHERE w.id = wishlist_id AND w.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.wishlists w WHERE w.id = wishlist_id AND w.user_id = auth.uid()));

CREATE TABLE public.travel_companions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  relationship text,
  email text,
  phone text,
  date_of_birth date,
  passport_number text,
  passport_country char(2),
  passport_expiry date,
  dietary text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX travel_companions_user_idx ON public.travel_companions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.travel_companions TO authenticated;
GRANT ALL ON public.travel_companions TO service_role;
ALTER TABLE public.travel_companions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own companions" ON public.travel_companions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER travel_companions_set_updated_at BEFORE UPDATE ON public.travel_companions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.trip_companions (
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  companion_id uuid NOT NULL REFERENCES public.travel_companions(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'traveler',
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, companion_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_companions TO authenticated;
GRANT ALL ON public.trip_companions TO service_role;
ALTER TABLE public.trip_companions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own trip companions" ON public.trip_companions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.user_id = auth.uid()));

CREATE TABLE public.transport_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind public.booking_type NOT NULL,
  website text,
  logo_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transport_providers TO anon, authenticated;
GRANT ALL ON public.transport_providers TO service_role;
ALTER TABLE public.transport_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Providers public" ON public.transport_providers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage providers" ON public.transport_providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.hotels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  brand text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  address text,
  lat numeric(9,6),
  lng numeric(9,6),
  stars smallint CHECK (stars IS NULL OR (stars BETWEEN 1 AND 5)),
  rating numeric(3,2) CHECK (rating IS NULL OR (rating BETWEEN 0 AND 5)),
  price_tier smallint CHECK (price_tier IS NULL OR (price_tier BETWEEN 1 AND 4)),
  hero_image text,
  amenities text[] NOT NULL DEFAULT '{}',
  provider_id uuid REFERENCES public.transport_providers(id) ON DELETE SET NULL,
  external_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX hotels_city_idx ON public.hotels(city_id);
CREATE INDEX hotels_rating_idx ON public.hotels(rating DESC NULLS LAST);
GRANT SELECT ON public.hotels TO anon, authenticated;
GRANT ALL ON public.hotels TO service_role;
ALTER TABLE public.hotels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Hotels public" ON public.hotels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage hotels" ON public.hotels FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER hotels_set_updated_at BEFORE UPDATE ON public.hotels FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.flights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carrier text NOT NULL,
  flight_number text NOT NULL,
  origin_iata char(3) NOT NULL,
  destination_iata char(3) NOT NULL,
  depart_at timestamptz NOT NULL,
  arrive_at timestamptz NOT NULL,
  aircraft text,
  cabin text,
  price_cents bigint CHECK (price_cents IS NULL OR price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  provider_id uuid REFERENCES public.transport_providers(id) ON DELETE SET NULL,
  external_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (arrive_at > depart_at),
  UNIQUE (carrier, flight_number, depart_at)
);
CREATE INDEX flights_route_idx ON public.flights(origin_iata, destination_iata, depart_at);
GRANT SELECT ON public.flights TO anon, authenticated;
GRANT ALL ON public.flights TO service_role;
ALTER TABLE public.flights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Flights public" ON public.flights FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage flights" ON public.flights FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER flights_set_updated_at BEFORE UPDATE ON public.flights FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  category text,
  description text,
  duration_min integer CHECK (duration_min IS NULL OR duration_min >= 0),
  price_cents bigint CHECK (price_cents IS NULL OR price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  rating numeric(3,2) CHECK (rating IS NULL OR (rating BETWEEN 0 AND 5)),
  hero_image text,
  provider_id uuid REFERENCES public.transport_providers(id) ON DELETE SET NULL,
  external_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX experiences_city_idx ON public.experiences(city_id);
GRANT SELECT ON public.experiences TO anon, authenticated;
GRANT ALL ON public.experiences TO service_role;
ALTER TABLE public.experiences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Experiences public" ON public.experiences FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage experiences" ON public.experiences FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER experiences_set_updated_at BEFORE UPDATE ON public.experiences FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  country_id uuid REFERENCES public.countries(id) ON DELETE SET NULL,
  cuisine text[] NOT NULL DEFAULT '{}',
  price_tier smallint CHECK (price_tier IS NULL OR (price_tier BETWEEN 1 AND 4)),
  rating numeric(3,2) CHECK (rating IS NULL OR (rating BETWEEN 0 AND 5)),
  address text,
  lat numeric(9,6),
  lng numeric(9,6),
  hero_image text,
  external_ref jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX restaurants_city_idx ON public.restaurants(city_id);
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restaurants public" ON public.restaurants FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage restaurants" ON public.restaurants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER restaurants_set_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  kind text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tags TO anon, authenticated;
GRANT ALL ON public.tags TO service_role;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tags public" ON public.tags FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage tags" ON public.tags FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.taggables (
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  target_kind public.taggable_kind NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tag_id, target_kind, target_id)
);
CREATE INDEX taggables_target_idx ON public.taggables(target_kind, target_id);
GRANT SELECT ON public.taggables TO anon, authenticated;
GRANT ALL ON public.taggables TO service_role;
ALTER TABLE public.taggables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Taggables public" ON public.taggables FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage taggables" ON public.taggables FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_kind public.image_owner_kind NOT NULL,
  owner_id uuid NOT NULL,
  uploader_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url text NOT NULL,
  storage_path text,
  alt text,
  width integer,
  height integer,
  bytes bigint,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX images_owner_idx ON public.images(owner_kind, owner_id, position);
GRANT SELECT ON public.images TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.images TO authenticated;
GRANT ALL ON public.images TO service_role;
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Images readable" ON public.images FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Uploader manages own images" ON public.images FOR ALL TO authenticated
  USING (auth.uid() = uploader_id) WITH CHECK (auth.uid() = uploader_id);
CREATE POLICY "Admins manage all images" ON public.images FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_kind public.review_target_kind NOT NULL,
  target_id uuid NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  body text,
  visited_on date,
  helpful_count integer NOT NULL DEFAULT 0,
  is_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','flagged','removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE (user_id, target_kind, target_id)
);
CREATE INDEX reviews_target_idx ON public.reviews(target_kind, target_id, created_at DESC) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX reviews_user_idx ON public.reviews(user_id, created_at DESC);
GRANT SELECT ON public.reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published reviews public" ON public.reviews FOR SELECT TO anon, authenticated
  USING (status = 'published' AND deleted_at IS NULL);
CREATE POLICY "Own reviews all" ON public.reviews FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins moderate reviews" ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE TRIGGER reviews_set_updated_at BEFORE UPDATE ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  reference text NOT NULL UNIQUE,
  booking_type public.booking_type NOT NULL,
  status public.booking_status NOT NULL DEFAULT 'pending',
  provider_id uuid REFERENCES public.transport_providers(id) ON DELETE SET NULL,
  provider_ref text,
  currency text NOT NULL DEFAULT 'USD',
  subtotal_cents bigint NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  tax_cents bigint NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  fees_cents bigint NOT NULL DEFAULT 0 CHECK (fees_cents >= 0),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  primary_traveler_name text,
  contact_email text,
  contact_phone text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX bookings_user_status_idx ON public.bookings(user_id, status, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX bookings_trip_idx ON public.bookings(trip_id) WHERE deleted_at IS NULL;
CREATE INDEX bookings_upcoming_idx ON public.bookings(user_id, starts_at) WHERE status IN ('confirmed','ticketed') AND deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own bookings" ON public.bookings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER bookings_set_updated_at BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  item_type public.booking_type NOT NULL,
  hotel_id uuid REFERENCES public.hotels(id) ON DELETE SET NULL,
  flight_id uuid REFERENCES public.flights(id) ON DELETE SET NULL,
  experience_id uuid REFERENCES public.experiences(id) ON DELETE SET NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  unit_price_cents bigint NOT NULL DEFAULT 0 CHECK (unit_price_cents >= 0),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  travelers jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_items_booking_idx ON public.booking_items(booking_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.booking_items TO authenticated;
GRANT ALL ON public.booking_items TO service_role;
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own booking items" ON public.booking_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));

ALTER TABLE public.trip_activities
  ADD CONSTRAINT trip_activities_booking_item_fk
  FOREIGN KEY (booking_item_id) REFERENCES public.booking_items(id) ON DELETE SET NULL;

CREATE TABLE public.booking_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_status public.booking_status,
  to_status public.booking_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX booking_history_booking_idx ON public.booking_history(booking_id, created_at DESC);
GRANT SELECT ON public.booking_history TO authenticated;
GRANT ALL ON public.booking_history TO service_role;
ALTER TABLE public.booking_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own booking history" ON public.booking_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND b.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.tg_booking_status_history()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.booking_history(booking_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NULL, NEW.status, auth.uid());
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.booking_history(booking_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.tg_booking_status_history() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER bookings_status_history
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.tg_booking_status_history();

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  provider text NOT NULL,
  provider_ref text,
  method public.payment_method NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'initiated',
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  captured_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_user_idx ON public.payments(user_id, created_at DESC);
CREATE INDEX payments_booking_idx ON public.payments(booking_id);
GRANT SELECT ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD',
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed')),
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX refunds_payment_idx ON public.refunds(payment_id);
GRANT SELECT ON public.refunds TO authenticated;
GRANT ALL ON public.refunds TO service_role;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own refunds" ON public.refunds FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_id AND p.user_id = auth.uid()));
CREATE TRIGGER refunds_set_updated_at BEFORE UPDATE ON public.refunds FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  currency text NOT NULL DEFAULT 'USD',
  subtotal_cents bigint NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  tax_cents bigint NOT NULL DEFAULT 0 CHECK (tax_cents >= 0),
  total_cents bigint NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','paid','void','refunded')),
  pdf_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_user_idx ON public.invoices(user_id, issued_at DESC);
GRANT SELECT ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own invoices" ON public.invoices FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.prompt_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL,
  agent public.ai_agent NOT NULL,
  version integer NOT NULL DEFAULT 1,
  system_prompt text NOT NULL,
  user_prompt_template text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug, version)
);
GRANT SELECT ON public.prompt_templates TO authenticated;
GRANT ALL ON public.prompt_templates TO service_role;
ALTER TABLE public.prompt_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prompt templates readable" ON public.prompt_templates FOR SELECT TO authenticated USING (is_active);
CREATE POLICY "Admins manage prompts" ON public.prompt_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER prompt_templates_set_updated_at BEFORE UPDATE ON public.prompt_templates FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  agent public.ai_agent NOT NULL DEFAULT 'general',
  title text,
  model text,
  provider text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived','error')),
  message_count integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  total_cost_micros bigint NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX ai_conversations_user_idx ON public.ai_conversations(user_id, updated_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX ai_conversations_trip_idx ON public.ai_conversations(trip_id) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own AI conversations" ON public.ai_conversations FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER ai_conversations_set_updated_at BEFORE UPDATE ON public.ai_conversations FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

ALTER TABLE public.itineraries
  ADD CONSTRAINT itineraries_ai_conversation_fk
  FOREIGN KEY (ai_conversation_id) REFERENCES public.ai_conversations(id) ON DELETE SET NULL;

CREATE TABLE public.ai_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  role public.ai_role NOT NULL,
  content text,
  content_structured jsonb,
  tool_name text,
  tool_input jsonb,
  tool_output jsonb,
  prompt_template_id uuid REFERENCES public.prompt_templates(id) ON DELETE SET NULL,
  model text,
  finish_reason text,
  input_tokens integer,
  output_tokens integer,
  cost_micros bigint,
  latency_ms integer,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_conversation_idx ON public.ai_messages(conversation_id, position);
CREATE INDEX ai_messages_created_idx ON public.ai_messages(created_at DESC);
GRANT SELECT, INSERT ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own AI messages" ON public.ai_messages FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid()));

CREATE TABLE public.ai_planner_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  request jsonb NOT NULL,
  plan jsonb NOT NULL,
  model text,
  tokens_input integer,
  tokens_output integer,
  cost_micros bigint,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_planner_history_user_idx ON public.ai_planner_history(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.ai_planner_history TO authenticated;
GRANT ALL ON public.ai_planner_history TO service_role;
ALTER TABLE public.ai_planner_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own planner history" ON public.ai_planner_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent public.ai_agent NOT NULL,
  subject_kind text NOT NULL,
  subject_id uuid,
  score numeric(5,4) CHECK (score IS NULL OR (score BETWEEN 0 AND 1)),
  reason text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  shown_at timestamptz,
  clicked_at timestamptz,
  dismissed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_recommendations_user_idx ON public.ai_recommendations(user_id, created_at DESC) WHERE dismissed_at IS NULL;
GRANT SELECT, UPDATE ON public.ai_recommendations TO authenticated;
GRANT ALL ON public.ai_recommendations TO service_role;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own recommendations" ON public.ai_recommendations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Update own recommendations" ON public.ai_recommendations FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.conversation_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('user','conversation','trip')),
  key text NOT NULL,
  value jsonb NOT NULL,
  importance smallint NOT NULL DEFAULT 1 CHECK (importance BETWEEN 1 AND 5),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_memory_user_scope_idx ON public.conversation_memory(user_id, scope, key);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_memory TO authenticated;
GRANT ALL ON public.conversation_memory TO service_role;
ALTER TABLE public.conversation_memory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own memory" ON public.conversation_memory FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER conversation_memory_set_updated_at BEFORE UPDATE ON public.conversation_memory FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  context jsonb NOT NULL,
  token_estimate integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX context_snapshots_user_idx ON public.context_snapshots(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.context_snapshots TO authenticated;
GRANT ALL ON public.context_snapshots TO service_role;
ALTER TABLE public.context_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own snapshots" ON public.context_snapshots FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES public.ai_conversations(id) ON DELETE SET NULL,
  agent public.ai_agent,
  provider text NOT NULL,
  model text NOT NULL,
  operation text NOT NULL,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer GENERATED ALWAYS AS (COALESCE(input_tokens,0) + COALESCE(output_tokens,0)) STORED,
  cost_micros bigint NOT NULL DEFAULT 0,
  duration_ms integer,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','error','timeout','cancelled')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_user_day_idx ON public.ai_usage(user_id, created_at DESC);
CREATE INDEX ai_usage_model_idx ON public.ai_usage(model, created_at DESC);
CREATE INDEX ai_usage_conversation_idx ON public.ai_usage(conversation_id);
GRANT SELECT ON public.ai_usage TO authenticated;
GRANT ALL ON public.ai_usage TO service_role;
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own usage" ON public.ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.notification_kind NOT NULL,
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  priority public.notification_priority NOT NULL DEFAULT 'normal',
  title text NOT NULL,
  body text,
  action_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, created_at DESC) WHERE read_at IS NULL AND archived_at IS NULL;
CREATE INDEX notifications_user_all_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.notification_preferences (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind public.notification_kind NOT NULL,
  channel public.notification_channel NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own notification prefs" ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  from_email text,
  subject text NOT NULL,
  template_slug text,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.email_status NOT NULL DEFAULT 'queued',
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  provider_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_queue_status_sched_idx ON public.email_queue(status, scheduled_at) WHERE status IN ('queued','sending');
GRANT ALL ON public.email_queue TO service_role;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER email_queue_set_updated_at BEFORE UPDATE ON public.email_queue FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.push_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.push_status NOT NULL DEFAULT 'queued',
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_queue_status_sched_idx ON public.push_queue(status, scheduled_at) WHERE status IN ('queued','sending');
GRANT ALL ON public.push_queue TO service_role;
ALTER TABLE public.push_queue ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER push_queue_set_updated_at BEFORE UPDATE ON public.push_queue FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assignee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text NOT NULL,
  category text,
  status public.ticket_status NOT NULL DEFAULT 'open',
  priority public.ticket_priority NOT NULL DEFAULT 'normal',
  booking_id uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX support_tickets_user_idx ON public.support_tickets(user_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX support_tickets_status_idx ON public.support_tickets(status, priority, last_message_at DESC) WHERE deleted_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own tickets" ON public.support_tickets FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff view tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "Staff update tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE TRIGGER support_tickets_set_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_staff boolean NOT NULL DEFAULT false,
  body text NOT NULL,
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','internal')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_ticket_idx ON public.support_messages(ticket_id, created_at);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ticket owner reads messages" ON public.support_messages FOR SELECT TO authenticated
  USING (visibility = 'public' AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "Ticket owner posts messages" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid()) AND author_id = auth.uid() AND is_staff = false AND visibility = 'public');
CREATE POLICY "Staff read messages" ON public.support_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "Staff post messages" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator')) AND author_id = auth.uid());

CREATE TABLE public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  filename text NOT NULL,
  url text NOT NULL,
  content_type text,
  bytes bigint CHECK (bytes IS NULL OR bytes >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_attachments_msg_idx ON public.support_attachments(message_id);
GRANT SELECT, INSERT ON public.support_attachments TO authenticated;
GRANT ALL ON public.support_attachments TO service_role;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ticket attachments visible" ON public.support_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_messages m
    JOIN public.support_tickets t ON t.id = m.ticket_id
    WHERE m.id = message_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'moderator'))
  ));

CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_kind text,
  target_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_user_idx ON public.activity_logs(user_id, created_at DESC);
CREATE INDEX activity_logs_action_idx ON public.activity_logs(action, created_at DESC);
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own activity" ON public.activity_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action public.audit_action NOT NULL,
  target_table text,
  target_id uuid,
  before jsonb,
  after jsonb,
  ip inet,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_actor_idx ON public.audit_logs(actor_id, created_at DESC);
CREATE INDEX audit_logs_target_idx ON public.audit_logs(target_table, target_id, created_at DESC);
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.search_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL,
  query text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX search_history_user_idx ON public.search_history(user_id, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.search_history TO authenticated;
GRANT ALL ON public.search_history TO service_role;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own search history" ON public.search_history FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.feature_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  feature text NOT NULL,
  count integer NOT NULL DEFAULT 1 CHECK (count >= 1),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX feature_usage_feature_idx ON public.feature_usage(feature, created_at DESC);
CREATE INDEX feature_usage_user_idx ON public.feature_usage(user_id, feature, created_at DESC);
GRANT SELECT ON public.feature_usage TO authenticated;
GRANT ALL ON public.feature_usage TO service_role;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own feature usage" ON public.feature_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id uuid,
  name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_name_time_idx ON public.events(name, occurred_at DESC);
CREATE INDEX events_user_idx ON public.events(user_id, occurred_at DESC);
GRANT SELECT ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own events" ON public.events FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE VIEW public.v_trip_overview WITH (security_invoker = true) AS
SELECT
  t.id, t.user_id, t.title, t.status, t.visibility, t.start_date, t.end_date,
  t.currency, t.budget_total_cents, t.traveler_count,
  d.slug AS destination_slug, d.name AS destination_name,
  (SELECT COUNT(*) FROM public.trip_days td WHERE td.trip_id = t.id) AS day_count,
  (SELECT COUNT(*) FROM public.trip_activities ta WHERE ta.trip_id = t.id) AS activity_count,
  (SELECT COUNT(*) FROM public.bookings b WHERE b.trip_id = t.id AND b.deleted_at IS NULL) AS booking_count
FROM public.trips t
LEFT JOIN public.destinations d ON d.id = t.primary_destination_id
WHERE t.deleted_at IS NULL;
GRANT SELECT ON public.v_trip_overview TO authenticated;

CREATE OR REPLACE VIEW public.v_booking_summary WITH (security_invoker = true) AS
SELECT
  b.id, b.user_id, b.trip_id, b.reference, b.booking_type, b.status,
  b.currency, b.total_cents, b.starts_at, b.ends_at, b.created_at,
  (SELECT COUNT(*) FROM public.booking_items bi WHERE bi.booking_id = b.id) AS item_count,
  (SELECT SUM(p.amount_cents) FROM public.payments p WHERE p.booking_id = b.id AND p.status = 'captured') AS paid_cents,
  (SELECT SUM(r.amount_cents) FROM public.refunds r JOIN public.payments p2 ON p2.id = r.payment_id WHERE p2.booking_id = b.id AND r.status = 'succeeded') AS refunded_cents
FROM public.bookings b
WHERE b.deleted_at IS NULL;
GRANT SELECT ON public.v_booking_summary TO authenticated;

INSERT INTO public.permissions(code, description) VALUES
  ('trips.read','Read trips'),
  ('trips.write','Create/edit trips'),
  ('bookings.read','Read bookings'),
  ('bookings.write','Create/edit bookings'),
  ('content.moderate','Moderate reviews and content'),
  ('content.write','Create/edit catalog content'),
  ('users.read','Read user directory'),
  ('users.write','Manage users'),
  ('billing.manage','Manage billing and refunds'),
  ('ai.use','Use AI features'),
  ('support.staff','Staff access to support tickets'),
  ('audit.read','Read audit logs')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.role_permissions(role, permission_id)
SELECT 'user'::public.app_role, id FROM public.permissions WHERE code IN ('trips.read','trips.write','bookings.read','bookings.write','ai.use')
ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role, permission_id)
SELECT 'moderator'::public.app_role, id FROM public.permissions WHERE code IN ('trips.read','bookings.read','content.moderate','support.staff','users.read')
ON CONFLICT DO NOTHING;
INSERT INTO public.role_permissions(role, permission_id)
SELECT 'admin'::public.app_role, id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.countries(iso2, iso3, name, continent, currency, phone_code, emoji) VALUES
  ('US','USA','United States','North America','USD','+1','🇺🇸'),
  ('GB','GBR','United Kingdom','Europe','GBP','+44','🇬🇧'),
  ('FR','FRA','France','Europe','EUR','+33','🇫🇷'),
  ('IT','ITA','Italy','Europe','EUR','+39','🇮🇹'),
  ('ES','ESP','Spain','Europe','EUR','+34','🇪🇸'),
  ('PT','PRT','Portugal','Europe','EUR','+351','🇵🇹'),
  ('IS','ISL','Iceland','Europe','ISK','+354','🇮🇸'),
  ('MA','MAR','Morocco','Africa','MAD','+212','🇲🇦'),
  ('JP','JPN','Japan','Asia','JPY','+81','🇯🇵'),
  ('ID','IDN','Indonesia','Asia','IDR','+62','🇮🇩'),
  ('IN','IND','India','Asia','INR','+91','🇮🇳'),
  ('TH','THA','Thailand','Asia','THB','+66','🇹🇭'),
  ('AE','ARE','United Arab Emirates','Asia','AED','+971','🇦🇪'),
  ('AU','AUS','Australia','Oceania','AUD','+61','🇦🇺'),
  ('NZ','NZL','New Zealand','Oceania','NZD','+64','🇳🇿'),
  ('BR','BRA','Brazil','South America','BRL','+55','🇧🇷'),
  ('AR','ARG','Argentina','South America','ARS','+54','🇦🇷'),
  ('MX','MEX','Mexico','North America','MXN','+52','🇲🇽'),
  ('CA','CAN','Canada','North America','CAD','+1','🇨🇦'),
  ('DE','DEU','Germany','Europe','EUR','+49','🇩🇪')
ON CONFLICT (iso2) DO NOTHING;

INSERT INTO public.cities(country_id, name, slug, lat, lng, timezone)
SELECT c.id, x.name, x.slug, x.lat, x.lng, x.tz FROM public.countries c
JOIN (VALUES
  ('JP','Tokyo','tokyo',35.6762,139.6503,'Asia/Tokyo'),
  ('ID','Ubud','ubud',-8.5069,115.2625,'Asia/Makassar'),
  ('IS','Reykjavik','reykjavik',64.1466,-21.9426,'Atlantic/Reykjavik'),
  ('IT','Cortina','cortina',46.5405,12.1357,'Europe/Rome'),
  ('PT','Lisbon','lisbon',38.7223,-9.1393,'Europe/Lisbon'),
  ('MA','Marrakech','marrakech',31.6295,-7.9811,'Africa/Casablanca')
) AS x(iso2, name, slug, lat, lng, tz) ON x.iso2 = c.iso2
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.destinations(slug, name, tagline, description, city_id, country_id, hero_image, featured, best_months, avg_budget_usd)
SELECT x.slug, x.name, x.tagline, x.description, ci.id, ci.country_id, x.hero, true, x.months, x.budget
FROM (VALUES
  ('tokyo','Tokyo','Where tradition meets tomorrow','Neon-lit streets, temple gardens, and the world''s best commutes.','tokyo','/src/assets/dest-tokyo.jpg', ARRAY[3,4,5,10,11]::smallint[], 2400),
  ('bali-ubud','Bali · Ubud','Jungle temples and rice terraces','Slow mornings, forest walks, and long lunches over rice paddies.','ubud','/src/assets/dest-bali.jpg', ARRAY[4,5,6,9]::smallint[], 1500),
  ('iceland-ring-road','Iceland Ring Road','Fire, ice, and endless daylight','Waterfalls, black sand, and the midnight sun on a loop.','reykjavik','/src/assets/dest-iceland.jpg', ARRAY[6,7,8]::smallint[], 3200),
  ('dolomites','Dolomites','Alpine cathedrals','Sharp granite spires, rifugio lunches, and turquoise lakes.','cortina','/src/assets/dest-dolomites.jpg', ARRAY[6,7,8,9]::smallint[], 2600),
  ('lisbon','Lisbon','Sunlit tiles by the Atlantic','Trams, pastel de nata, and fado echoing through Alfama.','lisbon','/src/assets/dest-lisbon.jpg', ARRAY[4,5,9,10]::smallint[], 1700),
  ('marrakech','Marrakech','Souks, spice, and sunset riads','Medina mazes, rooftop mint tea, and the Atlas on the horizon.','marrakech','/src/assets/dest-marrakech.jpg', ARRAY[3,4,10,11]::smallint[], 1400)
) AS x(slug, name, tagline, description, city_slug, hero, months, budget)
JOIN public.cities ci ON ci.slug = x.city_slug
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tags(slug, label, kind) VALUES
  ('beach','Beach','vibe'),('mountains','Mountains','vibe'),('city-break','City break','vibe'),
  ('foodie','Foodie','vibe'),('wellness','Wellness','vibe'),('adventure','Adventure','vibe'),
  ('family','Family','audience'),('couples','Couples','audience'),('solo','Solo','audience'),
  ('luxury','Luxury','budget'),('mid-range','Mid-range','budget'),('budget','Budget','budget')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.prompt_templates(slug, agent, version, system_prompt, user_prompt_template, input_schema, output_schema) VALUES
  ('planner.v1','planner',1,
   'You are Easy Trip''s planner agent. Design detailed, realistic day-by-day itineraries respecting user preferences, pace, and budget. Always return structured JSON matching the output_schema.',
   'Plan a trip to {{destination}} from {{start_date}} to {{end_date}} for {{traveler_count}} travelers with a {{pace}} pace. Budget: {{budget}}. Preferences: {{preferences}}.',
   '{"type":"object","required":["destination","start_date","end_date"]}'::jsonb,
   '{"type":"object","required":["days"]}'::jsonb),
  ('budget.v1','budget',1,
   'You are Easy Trip''s budget agent. Break a trip budget into flights, lodging, food, transit, activities, and buffer categories with realistic estimates for the destination and pace.',
   'Estimate a budget for {{destination}} over {{nights}} nights for {{traveler_count}} travelers, tier {{budget_tier}}.',
   '{}'::jsonb,
   '{"type":"object","required":["currency","total_cents","categories"]}'::jsonb),
  ('recommendation.v1','recommendation',1,
   'You are Easy Trip''s recommendation agent. Suggest destinations, experiences, or restaurants tailored to the user''s preferences and past trips.',
   'Recommend {{count}} {{subject_kind}}s for a user who likes {{preferences}} and has visited {{history}}.',
   '{}'::jsonb,
   '{"type":"object","required":["items"]}'::jsonb),
  ('safety.v1','safety',1,
   'You are Easy Trip''s safety agent. Provide concise, current safety guidance for a destination, including travel advisories, health considerations, and local etiquette.',
   'Provide safety guidance for {{destination}} in {{month}}.',
   '{}'::jsonb,
   '{"type":"object"}'::jsonb)
ON CONFLICT (slug, version) DO NOTHING;
