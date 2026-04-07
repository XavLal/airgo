import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SPOT_TYPE_CODES } from '../constants/spotTypes';
import type { SvgProps } from 'react-native-svg';
import AaIcon from '../../assets/icons/spot/AA.svg';
import AcIcon from '../../assets/icons/spot/AC.svg';
import AcfIcon from '../../assets/icons/spot/ACF.svg';
import AcsIcon from '../../assets/icons/spot/ACS.svg';
import ApccIcon from '../../assets/icons/spot/APCC.svg';
import ApnIcon from '../../assets/icons/spot/APN.svg';
import AsIcon from '../../assets/icons/spot/AS.svg';
import AsnIcon from '../../assets/icons/spot/ASN.svg';
import OtherIcon from '../../assets/icons/spot/OTHER.svg';
import AaPinIcon from '../../assets/icons/spot/AA_pin.svg';
import AcPinIcon from '../../assets/icons/spot/AC_pin.svg';
import AcfPinIcon from '../../assets/icons/spot/ACF_pin.svg';
import AcsPinIcon from '../../assets/icons/spot/ACS_pin.svg';
import ApccPinIcon from '../../assets/icons/spot/APCC_pin.svg';
import ApnPinIcon from '../../assets/icons/spot/APN_pin.svg';
import AsPinIcon from '../../assets/icons/spot/AS_pin.svg';
import AsnPinIcon from '../../assets/icons/spot/ASN_pin.svg';

export type SpotType = 'AA' | 'AC' | 'APN' | 'ACF' | 'ACS' | 'AS' | 'ASN' | 'APCC' | 'OTHER';
export type SpotIconVariant = 'icon' | 'badge' | 'pin';

interface SpotIconProps {
  type: SpotType;
  size?: number;
  variant?: SpotIconVariant;
}

export const SPOT_TYPE_LABELS: Record<SpotType, string> = {
  AA: 'Aire sur Autoroute',
  AC: 'Aire de Camping',
  APN: 'Parking Tolere Nuit',
  ACF: 'Accueil a la Ferme',
  ACS: 'Service sur Camping',
  AS: 'Aire de Service',
  ASN: 'Service + Stationnement Nuit',
  APCC: 'Parking Camping-Car Dedie',
  OTHER: 'Autre',
};

export function toSpotIconType(code: string): SpotType {
  return (SPOT_TYPE_CODES as readonly string[]).includes(code) ? (code as SpotType) : 'OTHER';
}

type SvgIconComponent = React.FC<SvgProps>;

const DEFAULT_ICON: SvgIconComponent = OtherIcon;

const ICON_MAP: Record<SpotType, SvgIconComponent> = {
  AA: AaIcon,
  AC: AcIcon,
  APN: ApnIcon,
  ACF: AcfIcon,
  ACS: AcsIcon,
  AS: AsIcon,
  ASN: AsnIcon,
  APCC: ApccIcon,
  OTHER: OtherIcon,
};

const PIN_ICON_MAP: Record<SpotType, SvgIconComponent> = {
  AA: AaPinIcon,
  AC: AcPinIcon,
  APN: ApnPinIcon,
  ACF: AcfPinIcon,
  ACS: AcsPinIcon,
  AS: AsPinIcon,
  ASN: AsnPinIcon,
  APCC: ApccPinIcon,
  OTHER: OtherIcon,
};

export default function SpotIcon({ type, size = 32, variant = 'icon' }: SpotIconProps) {
  const Icon = variant === 'pin' ? (PIN_ICON_MAP[type] ?? DEFAULT_ICON) : (ICON_MAP[type] ?? DEFAULT_ICON);
  const height = variant === 'pin' ? Math.round(size * 1.2) : size;
  return (
    <View style={styles.wrap}>
      <Icon width={size} height={height} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
