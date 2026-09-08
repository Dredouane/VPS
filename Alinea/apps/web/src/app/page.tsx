import { redirect } from "next/navigation";

/** Point d'entrée : tout visiteur aboutit à la connexion. */
export default function Home() {
  redirect("/login");
}
