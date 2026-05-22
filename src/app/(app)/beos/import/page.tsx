import { redirect } from "next/navigation";

// The standalone Import page was merged into the New BEO page, which now
// offers Form / Text / PDF / PNG tabs. Keep this route as a permanent
// redirect so old bookmarks and the navbar's Import link still work.
export default function BEOImportRedirect() {
  redirect("/beos/new");
}
