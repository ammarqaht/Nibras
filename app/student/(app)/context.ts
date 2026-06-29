import { createContext, useContext } from 'react';

export type StudentUser = {
  id: number;
  membershipNo: number;
  name: string;
  stage: string;
  grade: string;
  groupId: number | null;
  individual: number;
  collective: number;
  deduction: number;
  balance: number;
  rankScore: number;
  hidePoints?: boolean;
  hidePointsMessage?: string;
  hidePointsTitle?: string;
};

export const StudentContext = createContext<{ user: StudentUser | null }>({ user: null });
export const useStudent = () => useContext(StudentContext);
