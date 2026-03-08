import React, { createContext, useCallback, useContext, useState } from "react";

interface RefreshContextType {
  /** Increment this after any expense/income create, update, or delete so all screens refetch. */
  transactionsRefreshKey: number;
  /** Call after saving or deleting an expense/income so dashboard, lists, and report update without manual refresh. */
  refreshTransactions: () => void;
}

const RefreshContext = createContext<RefreshContextType>({
  transactionsRefreshKey: 0,
  refreshTransactions: () => {},
});

export const RefreshProvider = ({ children }: { children: React.ReactNode }) => {
  const [transactionsRefreshKey, setTransactionsRefreshKey] = useState(0);
  const refreshTransactions = useCallback(() => {
    setTransactionsRefreshKey((k) => k + 1);
  }, []);

  return (
    <RefreshContext.Provider value={{ transactionsRefreshKey, refreshTransactions }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => useContext(RefreshContext);
