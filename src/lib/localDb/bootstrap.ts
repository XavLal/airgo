import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import { SPOT_DELTA_SYNC_TASK } from '../../tasks/spotSyncTask';
import { getIsOnline } from '../networkStatus';
import { countLocalSpots, getSpotsDatabase, getSyncMeta } from './client';
import {
  META_ASC_BOOTSTRAP_PENDING,
  runDeltaSpotSyncFromSupabase,
  runFullSpotSyncFromSupabase,
  runInitialSeedFromBundledAsc,
} from './spotSync';

export async function bootstrapLocalSpotsData(): Promise<void> {
  if (Platform.OS === 'web') return;

  await getSpotsDatabase();

  let n = await countLocalSpots();

  if (n === 0) {
    const seeded = await runInitialSeedFromBundledAsc();
    if (!seeded) {
      const online = await getIsOnline();
      if (online) {
        try {
          await runFullSpotSyncFromSupabase();
        } catch (e) {
          console.warn('Synchro initiale des aires impossible', e);
        }
      }
    }
  }

  n = await countLocalSpots();
  const online = await getIsOnline();
  const ascPending = (await getSyncMeta(META_ASC_BOOTSTRAP_PENDING)) === '1';

  if (online && n > 0 && !ascPending) {
    void runDeltaSpotSyncFromSupabase().catch((e) => console.warn('Delta sync (premier plan)', e));
  }

  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (status === BackgroundFetch.BackgroundFetchStatus.Available) {
      await BackgroundFetch.registerTaskAsync(SPOT_DELTA_SYNC_TASK, {
        minimumInterval: 24 * 60 * 60,
        stopOnTerminate: false,
        startOnBoot: true,
      });
    }
  } catch (e) {
    console.warn('Background fetch (delta aires) non enregistré', e);
  }
}
