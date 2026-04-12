"use client";

import { ChevronDown } from "lucide-react";

interface Props {
  accounts: Array<{ id: string; name: string }>;
  currentCustomerId: string;
  onSwitch: (customerId: string) => void;
  loading?: boolean;
}

export default function AccountSwitcher({
  accounts,
  currentCustomerId,
  onSwitch,
  loading,
}: Props) {
  if (accounts.length <= 1) return null;

  return (
    <div className="relative inline-block">
      <select
        value={currentCustomerId}
        onChange={(e) => onSwitch(e.target.value)}
        disabled={loading}
        className="bg-white/10 border border-white/10 text-white text-sm rounded-lg px-3 py-1.5 focus:border-accent outline-none appearance-none pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {accounts.map((account) => (
          <option
            key={account.id}
            value={account.id}
            className="bg-card text-white"
          >
            {account.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-white/60" />
    </div>
  );
}
