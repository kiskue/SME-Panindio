import React, { useRef, useEffect } from 'react';
import {
  View,
  Pressable,
  ScrollView,
  Animated,
  StyleSheet,
  LayoutChangeEvent,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { ComponentProps } from '@/types';
import { theme } from '../../core/theme';

export interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}

export interface TabsProps extends ComponentProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  variant?: 'line' | 'pill' | 'button';
  size?: 'sm' | 'md' | 'lg';
  scrollable?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export interface TabPanelProps {
  tabKey: string;
  activeTab: string;
  children: React.ReactNode;
}

const SIZE_MAP = {
  sm: { height: 36, font: 12, px: 12 },
  md: { height: 44, font: 14, px: 16 },
  lg: { height: 52, font: 16, px: 20 },
};

export const TabPanel: React.FC<TabPanelProps> = ({ tabKey, activeTab, children }) => {
  if (tabKey !== activeTab) return null;
  return <View>{children}</View>;
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  variant = 'line',
  size = 'md',
  scrollable = false,
  fullWidth = false,
  children,
  style,
}) => {
  const { height, font, px } = SIZE_MAP[size];
  const indicatorX   = useRef(new Animated.Value(0)).current;
  const indicatorW   = useRef(new Animated.Value(0)).current;
  const tabLayouts   = useRef<Record<string, { x: number; width: number }>>({});

  useEffect(() => {
    const layout = tabLayouts.current[activeTab];
    if (layout && variant === 'line') {
      Animated.parallel([
        Animated.spring(indicatorX, { toValue: layout.x, useNativeDriver: false, damping: 20, stiffness: 300 }),
        Animated.spring(indicatorW, { toValue: layout.width, useNativeDriver: false, damping: 20, stiffness: 300 }),
      ]).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, variant]);

  const handleLayout = (key: string, event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    tabLayouts.current[key] = { x, width };
    if (key === activeTab && variant === 'line') {
      indicatorX.setValue(x);
      indicatorW.setValue(width);
    }
  };

  const getTabItemStyle = (tab: Tab) => {
    const isActive = tab.key === activeTab;
    switch (variant) {
      case 'pill':
        return {
          backgroundColor: isActive ? theme.colors.primary[500] : 'transparent',
          borderRadius: theme.borderRadius.full,
        };
      case 'button':
        return {
          backgroundColor: isActive ? theme.colors.primary[500] : theme.colors.gray[100],
          borderRadius: theme.borderRadius.md,
          borderWidth: 1,
          borderColor: isActive ? theme.colors.primary[500] : theme.colors.gray[200],
        };
      default:
        return {};
    }
  };

  const getTabTextColor = (tab: Tab) => {
    const isActive = tab.key === activeTab;
    if (tab.disabled) return theme.colors.gray[400];
    switch (variant) {
      case 'pill':
      case 'button':
        return isActive ? theme.colors.white : theme.colors.gray[600];
      default:
        return isActive ? theme.colors.primary[500] : theme.colors.gray[500];
    }
  };

  const tabBar = (
    <View style={[styles.tabBar, fullWidth && styles.fullWidth, style]}>
      {tabs.map((tab, idx) => (
        <Pressable
          key={tab.key}
          onPress={() => !tab.disabled && onTabChange(tab.key)}
          disabled={tab.disabled}
          onLayout={e => handleLayout(tab.key, e)}
          style={[
            styles.tabItem,
            { height, paddingHorizontal: px },
            fullWidth && styles.tabItemFlex,
            getTabItemStyle(tab),
            idx > 0 && variant === 'button' && { marginLeft: 4 },
          ]}
        >
          {tab.icon !== undefined && <View style={styles.tabIcon}>{tab.icon}</View>}
          <RNText
            style={[
              styles.tabLabel,
              { fontSize: font, color: getTabTextColor(tab) },
              tab.key === activeTab && variant === 'line' && styles.tabLabelActive,
            ]}
            numberOfLines={1}
          >
            {tab.label}
          </RNText>
          {tab.badge !== undefined && tab.badge > 0 && (
            <View style={styles.badge}>
              <RNText style={styles.badgeText}>
                {tab.badge > 99 ? '99+' : tab.badge}
              </RNText>
            </View>
          )}
        </Pressable>
      ))}

      {variant === 'line' && (
        <Animated.View
          style={[
            styles.indicator,
            { left: indicatorX, width: indicatorW },
          ]}
        />
      )}
    </View>
  );

  return (
    <View>
      {scrollable
        ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={variant === 'line' ? styles.lineContainer : undefined}
          >
            {tabBar}
          </ScrollView>
        )
        : (
          <View style={variant === 'line' ? styles.lineContainer : undefined}>
            {tabBar}
          </View>
        )}

      {children !== undefined && <View>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  lineContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  tabBar: {
    flexDirection: 'row',
    position: 'relative',
  },
  fullWidth: { flex: 1 },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tabItemFlex: { flex: 1 },
  tabLabel: {
    fontWeight: theme.typography.weights.medium,
  },
  tabLabelActive: {
    fontWeight: theme.typography.weights.semibold,
  },
  tabIcon: { flexShrink: 0 },
  badge: {
    backgroundColor: theme.colors.error[500],
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    color: theme.colors.white,
    fontWeight: '600',
  },
  indicator: {
    position: 'absolute',
    bottom: 0,
    height: 2,
    backgroundColor: theme.colors.primary[500],
    borderRadius: 1,
  },
});
