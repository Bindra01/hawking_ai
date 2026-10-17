CREATE TABLE "solve_usage" (
    "user_id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "daily_count" INTEGER NOT NULL DEFAULT 0,
    "minute_started_at" TIMESTAMPTZ(6) NOT NULL,
    "minute_count" INTEGER NOT NULL DEFAULT 0,
    "concurrent_token" TEXT,
    "concurrent_until" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solve_usage_pkey" PRIMARY KEY ("user_id")
);
