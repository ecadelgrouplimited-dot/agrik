-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('farmer', 'buyer', 'offtaker', 'service_provider', 'input_supplier');

-- CreateEnum
CREATE TYPE "ListingRole" AS ENUM ('seller', 'buyer');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "verification_status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identities" (
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "parish" TEXT NOT NULL,
    "crops" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "organization_name" TEXT,
    "service_categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "focus_crops" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "onboarding_stage" TEXT NOT NULL DEFAULT 'complete',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identities_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "user_settings" (
    "user_id" TEXT NOT NULL,
    "preferred_language" TEXT,
    "district" TEXT,
    "parish" TEXT,
    "sms_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "voice_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "weather_alerts" BOOLEAN NOT NULL DEFAULT true,
    "price_alerts" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "farm_profiles" (
    "farmer_id" TEXT NOT NULL,
    "crops" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "planting_dates" JSONB NOT NULL DEFAULT '[]',
    "soil_profile" JSONB NOT NULL DEFAULT '{}',
    "climate_exposure" JSONB NOT NULL DEFAULT '{}',
    "yield_estimates" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "farm_profiles_pkey" PRIMARY KEY ("farmer_id")
);

-- CreateTable
CREATE TABLE "email_verifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_resets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "verification_status" TEXT NOT NULL DEFAULT 'verified',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_otps" (
    "id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_activity" (
    "id" SERIAL NOT NULL,
    "admin_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "districts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,

    CONSTRAINT "districts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parishes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subcounty" TEXT,
    "district_id" TEXT NOT NULL,

    CONSTRAINT "parishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_listings" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT,
    "role" "ListingRole" NOT NULL DEFAULT 'seller',
    "crop" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION,
    "unit" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "grade" TEXT,
    "description" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "contact_whatsapp" TEXT,
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availability_start" TIMESTAMP(3),
    "availability_end" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'open',
    "district" TEXT,
    "parish" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geometry_wkt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_offers" (
    "id" SERIAL NOT NULL,
    "listing_id" INTEGER NOT NULL,
    "phone" TEXT NOT NULL,
    "price" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_services" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT,
    "service_type" TEXT NOT NULL,
    "description" TEXT,
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "coverage_radius_km" DOUBLE PRECISION,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "status" TEXT NOT NULL DEFAULT 'active',
    "district" TEXT,
    "parish" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geometry_wkt" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_prices" (
    "id" SERIAL NOT NULL,
    "crop" TEXT NOT NULL,
    "market" TEXT,
    "district" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "source" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_alerts" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "alert_type" TEXT NOT NULL,
    "crop" TEXT,
    "threshold" DOUBLE PRECISION,
    "channel" TEXT DEFAULT 'sms',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "min_interval_hours" INTEGER,
    "district" TEXT,
    "parish" TEXT,
    "last_triggered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "provider" TEXT,
    "external_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_services" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'UGX',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "email_verifications_user_id_idx" ON "email_verifications"("user_id");

-- CreateIndex
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admin_otps_admin_id_idx" ON "admin_otps"("admin_id");

-- CreateIndex
CREATE INDEX "admin_activity_admin_id_idx" ON "admin_activity"("admin_id");

-- CreateIndex
CREATE UNIQUE INDEX "districts_name_key" ON "districts"("name");

-- CreateIndex
CREATE INDEX "parishes_district_id_idx" ON "parishes"("district_id");

-- CreateIndex
CREATE UNIQUE INDEX "parishes_district_id_name_key" ON "parishes"("district_id", "name");

-- CreateIndex
CREATE INDEX "market_listings_status_idx" ON "market_listings"("status");

-- CreateIndex
CREATE INDEX "market_listings_district_idx" ON "market_listings"("district");

-- CreateIndex
CREATE INDEX "market_offers_listing_id_idx" ON "market_offers"("listing_id");

-- CreateIndex
CREATE INDEX "market_offers_phone_idx" ON "market_offers"("phone");

-- CreateIndex
CREATE INDEX "market_services_status_idx" ON "market_services"("status");

-- CreateIndex
CREATE INDEX "market_prices_crop_idx" ON "market_prices"("crop");

-- CreateIndex
CREATE INDEX "market_prices_district_idx" ON "market_prices"("district");

-- CreateIndex
CREATE INDEX "market_alerts_phone_idx" ON "market_alerts"("phone");

-- CreateIndex
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "platform_services_user_id_idx" ON "platform_services"("user_id");

-- CreateIndex
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages"("user_id");

-- AddForeignKey
ALTER TABLE "identities" ADD CONSTRAINT "identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "farm_profiles" ADD CONSTRAINT "farm_profiles_farmer_id_fkey" FOREIGN KEY ("farmer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verifications" ADD CONSTRAINT "email_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_otps" ADD CONSTRAINT "admin_otps_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_activity" ADD CONSTRAINT "admin_activity_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parishes" ADD CONSTRAINT "parishes_district_id_fkey" FOREIGN KEY ("district_id") REFERENCES "districts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_offers" ADD CONSTRAINT "market_offers_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "market_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_services" ADD CONSTRAINT "platform_services_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
