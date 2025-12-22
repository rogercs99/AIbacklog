import { redirect } from "next/navigation";

export default function ComparePage() {
  redirect("/plan?tab=compare");
}

