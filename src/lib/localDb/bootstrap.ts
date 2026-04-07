import * as BackgroundFetch from 'expo-background-fetch';
import { InteractionManager, Platform } from 'react-native';
import { SPOT_DELTA_SYNC_TASK } from '../../tasks/spotSyncTask';
import { getIsOnline } from '../networkStatus';
import { countLocalSpots, getSpotsDatabase } from './client';
import { runDeltaSpotSyncFromSupabase } from './spotSync';

/**
 * Initialise la base locale des aires au démarrage.
 *
 * Grâce au .db bundlé (copié automatiquement par expo-sqlite au 1er lancement),
 * la base contient déjà ~24k spots dès l'ouverture.
 * Seul un delta sync est nécessaire pour rattraper les changements
 * survenus depuis la génération du .db.
 */
export async function bootstrapLocalSpotsData(): Promise<void> {
  if (Platform.OS === 'web') return;

  await getSpotsDatabase();

  const n = await countLocalSpots();
  const online = await getIsOnline();

  if (online && n > 0) {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        void runDeltaSpotSyncFromSupabase().catch((e) =>
          console.warn('Delta sync (premier plan)', e),
        );
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
