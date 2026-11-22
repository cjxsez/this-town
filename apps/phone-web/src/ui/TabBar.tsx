import { NavLink } from "react-router";

const TABS = [
  { to: "/ride", label: "Ride" },
  { to: "/passport", label: "Passport" },
  { to: "/people", label: "People" },
  { to: "/me", label: "Me" },
];

export function TabBar() {
  return (
    <nav className="q-tabs" aria-label="Main">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className="q-tabs__tab">
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
