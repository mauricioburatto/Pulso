-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "modality" TEXT,
    "level" TEXT,
    "weight" DOUBLE PRECISION,
    "height" DOUBLE PRECISION,
    "training_time" TEXT,
    "birth_date" TIMESTAMP(3),
    "sex" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "athlete_core" (
    "athlete_id" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "athlete_core_pkey" PRIMARY KEY ("athlete_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- AddForeignKey
ALTER TABLE "athlete_core" ADD CONSTRAINT "athlete_core_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
