import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
    LayoutChangeEvent,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    TAB_BAR_BOTTOM_PADDING_MIN,
    TAB_BAR_HEIGHT,
} from "../constants/tabBar";
import { useTabBarLayout } from "../contexts/TabBarLayoutContext";
import { katechonTheme } from "../theme/katechon";

const ICON_SIZE = 24;
const NAV_ITEMS = [
    { label: "Deck", icon: "grid-outline" as const, active: true },
    { label: "Signals", icon: "pulse-outline" as const, active: false },
    { label: "Fork", icon: "git-branch-outline" as const, active: false },
    { label: "Kat", icon: "mic-outline" as const, active: false },
    { label: "Ops", icon: "terminal-outline" as const, active: false },
];

const BottomTabBar = () => {
    const insets = useSafeAreaInsets();
    const { setTabBarHeight } = useTabBarLayout();

    const handleLayout = (e: LayoutChangeEvent) => {
        const height = e.nativeEvent.layout.height;
        if (height > 0) setTabBarHeight(height);
    };

    return (
        <View
            style={[
                styles.tabBar,
                { paddingBottom: Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING_MIN) },
            ]}
            onLayout={handleLayout}
        >
            <View style={styles.navShell}>
                {NAV_ITEMS.map((item) => (
                    <TouchableOpacity
                        key={item.label}
                        style={[
                            styles.tabItem,
                            item.active && styles.tabItemActive,
                        ]}
                    >
                        <Ionicons
                            name={item.icon}
                            size={ICON_SIZE}
                            color={
                                item.active
                                    ? katechonTheme.green
                                    : katechonTheme.muted
                            }
                        />
                        <Text
                            style={[
                                styles.tabLabel,
                                item.active && styles.tabLabelActive,
                            ]}
                        >
                            {item.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
};

export default BottomTabBar;

export const styles = StyleSheet.create({
    tabBar: {
        position: "absolute",
        left: 12,
        right: 12,
        bottom: 0,
        minHeight: TAB_BAR_HEIGHT,
        alignItems: "stretch",
        justifyContent: "center",
        paddingTop: 10,
        zIndex: 10,
    },
    navShell: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        minHeight: TAB_BAR_HEIGHT - 10,
        borderWidth: 1,
        borderColor: katechonTheme.line,
        borderRadius: 8,
        backgroundColor: "rgba(5,6,8,0.86)",
        overflow: "hidden",
    },
    tabItem: {
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        alignSelf: "stretch",
        borderRightWidth: 1,
        borderRightColor: "rgba(242,244,247,0.07)",
    },
    tabItemActive: {
        backgroundColor: "rgba(0,232,123,0.08)",
    },
    tabLabel: {
        color: katechonTheme.muted,
        fontSize: 10,
        marginTop: 3,
        fontWeight: "700",
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },
    tabLabelActive: {
        color: katechonTheme.green,
    },
});
