-- CreateTable
CREATE TABLE "athlete_photos" (
    "id" TEXT NOT NULL,
    "athlete_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "object_key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "athlete_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "athlete_photos_athlete_id_idx" ON "athlete_photos"("athlete_id");

-- AddForeignKey
ALTER TABLE "athlete_photos" ADD CONSTRAINT "athlete_photos_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
