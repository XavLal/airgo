import * as BackgroundFetch from 'expo-background-fetch';
import { InteractionManager, Platform } from 'react-native';
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
    /**
     * Ne pas lancer le delta en parallèle immédiat des lectures carte (querySpotsInViewport) : sur Android,
     * expo-sqlite mélange connexion principale + withExclusiveTransactionAsync du sync → crash natif (Scudo /
     * closeDatabase). On attend la fin des interactions UI puis un court délai.
     */
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        void runDeltaSpotSyncFromSupabase().catch((e) => console.warn('Delta sync (premier plan)', e));
      }, 2500);
    });
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
