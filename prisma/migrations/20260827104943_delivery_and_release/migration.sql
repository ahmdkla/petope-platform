-- AlterTable
ALTER TABLE "Deal" ADD COLUMN     "handoverDeclaredByBuyerAt" TIMESTAMP(3),
ADD COLUMN     "handoverDeclaredBySellerAt" TIMESTAMP(3),
ADD COLUMN     "receiptConfirmedAt" TIMESTAMP(3);
