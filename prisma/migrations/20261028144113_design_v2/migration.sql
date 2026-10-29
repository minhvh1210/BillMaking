/*
  Warnings:

  - You are about to drop the column `templateId` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Bill` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `DocumentType` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `code` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `companyName` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `contactEmail` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `contactName` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `contactPhone` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `taxCode` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `enabled` on the `ProjectCargoType` table. All the data in the column will be lost.
  - You are about to drop the column `htmlSource` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `isDefault` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `query` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `sourceKind` on the `Template` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Template` table. All the data in the column will be lost.
  - Made the column `fileName` on table `Template` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fileSize` on table `Template` required. This step will fail if there are existing NULL values in that column.
  - Made the column `mimeType` on table `Template` required. This step will fail if there are existing NULL values in that column.
  - Made the column `storagePath` on table `Template` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Bill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentTypeId" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "sourceMimeType" TEXT,
    "sourceStoragePath" TEXT,
    "sourceFileSize" INTEGER,
    "sourceConverted" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "resultHtml" TEXT,
    "extractedFields" TEXT,
    "warnings" TEXT,
    "summary" TEXT,
    "errorMessage" TEXT,
    "model" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bill_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Bill" ("createdAt", "documentTypeId", "errorMessage", "extractedFields", "id", "inputTokens", "model", "outputTokens", "resultHtml", "sourceConverted", "sourceFileName", "sourceFileSize", "sourceMimeType", "sourceStoragePath", "status", "summary", "updatedAt", "warnings") SELECT "createdAt", "documentTypeId", "errorMessage", "extractedFields", "id", "inputTokens", "model", "outputTokens", "resultHtml", "sourceConverted", "sourceFileName", "sourceFileSize", "sourceMimeType", "sourceStoragePath", "status", "summary", "updatedAt", "warnings" FROM "Bill";
DROP TABLE "Bill";
ALTER TABLE "new_Bill" RENAME TO "Bill";
CREATE UNIQUE INDEX "Bill_documentTypeId_key" ON "Bill"("documentTypeId");
CREATE TABLE "new_DocumentType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectCargoTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "query" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentType_projectCargoTypeId_fkey" FOREIGN KEY ("projectCargoTypeId") REFERENCES "ProjectCargoType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DocumentType" ("code", "createdAt", "id", "name", "projectCargoTypeId", "updatedAt") SELECT "code", "createdAt", "id", "name", "projectCargoTypeId", "updatedAt" FROM "DocumentType";
DROP TABLE "DocumentType";
ALTER TABLE "new_DocumentType" RENAME TO "DocumentType";
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Project" ("createdAt", "id", "name", "updatedAt") SELECT "createdAt", "id", "name", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE TABLE "new_ProjectCargoType" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "cargoType" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectCargoType_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProjectCargoType" ("cargoType", "createdAt", "id", "projectId") SELECT "cargoType", "createdAt", "id", "projectId" FROM "ProjectCargoType";
DROP TABLE "ProjectCargoType";
ALTER TABLE "new_ProjectCargoType" RENAME TO "ProjectCargoType";
CREATE UNIQUE INDEX "ProjectCargoType_projectId_cargoType_key" ON "ProjectCargoType"("projectId", "cargoType");
CREATE TABLE "new_Template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentTypeId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "convertedHtml" TEXT,
    "placeholders" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Template_documentTypeId_fkey" FOREIGN KEY ("documentTypeId") REFERENCES "DocumentType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Template" ("convertedHtml", "createdAt", "documentTypeId", "fileName", "fileSize", "id", "mimeType", "placeholders", "storagePath") SELECT "convertedHtml", "createdAt", "documentTypeId", "fileName", "fileSize", "id", "mimeType", "placeholders", "storagePath" FROM "Template";
DROP TABLE "Template";
ALTER TABLE "new_Template" RENAME TO "Template";
CREATE UNIQUE INDEX "Template_documentTypeId_key" ON "Template"("documentTypeId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
