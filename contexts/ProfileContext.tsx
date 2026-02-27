import type { FarmerProfile } from "@/utils/api";
import React, { createContext, useContext, useState } from "react";

interface ProfileContextType {
  profile: FarmerProfile | null;
  setProfile: (p: FarmerProfile | null) => void;
}

const ProfileContext = createContext<ProfileContextType>({
  profile: null,
  setProfile: () => {},
});

export const ProfileProvider = ({ children }: any) => {
  const [profile, setProfile] = useState<FarmerProfile | null>(null);

  return (
    <ProfileContext.Provider value={{ profile, setProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => useContext(ProfileContext);
