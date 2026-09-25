import { apiClient } from '../../../shared/api/client.ts';
import type { AgentScriptInfo } from '../types/agent.types.ts';

export const agentApi = {
  async getScript(companyId: string): Promise<AgentScriptInfo> {
    const { data } = await apiClient.get<{ data: AgentScriptInfo }>(`/remotely/agent-script/${companyId}`);
    return data.data;
  },
};
