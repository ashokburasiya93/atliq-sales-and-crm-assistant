// The product was renamed to AtliQ Sales and CRM Assistant. Links to the old address keep working:
// they are permanently redirected to the same page on the new address.
import { NextResponse, type NextRequest } from "next/server";

const OLD_HOST = "atliq-sales-memory.vercel.app";
const NEW_HOST = "atliq-sales-and-crm-assistant.vercel.app";

export function middleware(req: NextRequest) {
  if (req.headers.get("host") === OLD_HOST) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${NEW_HOST}`);
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
