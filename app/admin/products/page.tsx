import { AdminProductsPage } from "@/components/admin/admin-resources-pages";
import { requireUser } from "@/lib/auth/session";
import { getProductsAndProtocols } from "@/lib/admin-resources-data";

export const dynamic = "force-dynamic";
export default async function ProductsPage() {
  const user = await requireUser(["owner", "admin", "operations"], "/admin/products");
  return <AdminProductsPage {...await getProductsAndProtocols(user.organizationId)} />;
}
