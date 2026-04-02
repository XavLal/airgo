import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

export const SPOT_DELTA_SYNC_TASK = 'AIRGO_SPOT_DELTA_SYNC';

TaskManager.defineTask(SPOT_DELTA_SYNC_TASK, async () => {
  try {
    const { runDeltaSpotSyncFromSupabase } = await import('../lib/localDb/spotSync');
    await runDeltaSpotSyncFromSupabase();
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});
