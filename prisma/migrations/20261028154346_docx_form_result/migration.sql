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
    "sourcePagePath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "resultKind" TEXT NOT NULL DEFAULT 'HTML',
    "resultHtml" TEXT,
    "resultPlacements" TEXT,
    "resultDocxPath" TEXT,
    "resultPdfPath" TEXT,
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
CREATE TABLE "new_BillVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "billId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'HTML',
    "html" TEXT NOT NULL,
    "placements" TEXT,
    "source" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillVersion_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_BillVersion" ("billId", "createdAt", "html", "id", "note", "source") SELECT "billId", "createdAt", "html", "id", "note", "source" FROM "BillVersion";
DROP TABLE "BillVersion";
ALTER TABLE "new_BillVersion" RENAME TO "BillVersion";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
