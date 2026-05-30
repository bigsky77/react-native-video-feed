import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    PanResponder,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMetrics } from "../contexts/MetricsContext";
import { useSeek } from "../contexts/SeekContext";
import { useTabBarLayout } from "../contexts/TabBarLayoutContext";
import {
    TAB_BAR_BOTTOM_PADDING_MIN,
    TAB_BAR_HEIGHT,
} from "../constants/tabBar";
import { PERFORMANCE_MONITOR_ENABLED } from "../utils/performance";
import { Video } from "../types";
import { katechonTheme } from "../theme/katechon";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const PLAY_BUTTON_SIZE = 88;
const PLAY_BUTTON_HALF = PLAY_BUTTON_SIZE / 2;
const RIGHT_ICON_SIZE = 34;
const AVATAR_SIZE = 42;
const BOTTOM_SECTION_MARGIN = 22;
const SEEK_BAR_HEIGHT = 3;
const SEEK_BAR_HIT_SLOP = 14;
const SEEK_BAR_AREA_HEIGHT = SEEK_BAR_HEIGHT + 2 * SEEK_BAR_HIT_SLOP;
const SEEK_TRACK_SCALE_DRAG = 3;
const SEEK_TRACK_ANIM_DURATION = 180;
const BOTTOM_GAP = 4;
const OVERLAY_HORIZONTAL_PADDING = 14;
const SEEK_TIMER_ANIM_DURATION = 200;
const SEEK_TIMER_OFFSET_ABOVE_BAR = 48;

function formatSeekTime(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

interface VideoOverlayProps {
    video: Video;
    isVisible: boolean;
    isPaused: boolean;
    progress?: number;
    duration?: number;
    onSeek?: (progress: number) => void;
}

const VideoOverlay = ({
    video,
    isVisible,
    isPaused,
    progress = 0,
    duration = 0,
    onSeek,
}: VideoOverlayProps) => {
    const insets = useSafeAreaInsets();
    const { toggleMetrics } = useMetrics();
    const { setSeeking } = useSeek();
    const { tabBarHeight: measuredTabBarHeight } = useTabBarLayout();
    const setSeekingRef = useRef(setSeeking);
    setSeekingRef.current = setSeeking;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const playButtonAnim = useRef(new Animated.Value(0)).current;

    const fallbackTabBarHeight =
        Platform.OS === "android"
            ? TAB_BAR_HEIGHT + TAB_BAR_BOTTOM_PADDING_MIN
            : TAB_BAR_HEIGHT +
              Math.max(insets.bottom, TAB_BAR_BOTTOM_PADDING_MIN);

    const [stableTabBarHeight, setStableTabBarHeight] = useState<number>(
        fallbackTabBarHeight,
    );

    useEffect(() => {
        if (measuredTabBarHeight !== null) {
            setStableTabBarHeight(measuredTabBarHeight);
        }
    }, [measuredTabBarHeight]);

    const tabBarHeight = stableTabBarHeight;
    const bottomPadding = tabBarHeight + BOTTOM_GAP;
    const seekBarBottom = tabBarHeight - 6;
    const rightColumnBottom = bottomPadding + BOTTOM_SECTION_MARGIN;

    const [seekingProgress, setSeekingProgress] = useState<number | null>(null);
    const trackLayoutRef = useRef({ x: 0, width: 1 });
    const seekTrackRef = useRef<View>(null);
    const onSeekRef = useRef(onSeek);
    const progressRef = useRef(progress);
    const trackScaleY = useRef(new Animated.Value(1)).current;
    const descOpacity = useRef(new Animated.Value(1)).current;
    const seekTimerOpacity = useRef(new Animated.Value(0)).current;
    const isDraggingRef = useRef(false);

    const hideSeekState = useRef(() => {
        setSeekingRef.current(false);
        isDraggingRef.current = false;
        Animated.parallel([
            Animated.timing(trackScaleY, {
                toValue: 1,
                duration: SEEK_TRACK_ANIM_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(descOpacity, {
                toValue: 1,
                duration: SEEK_TIMER_ANIM_DURATION,
                useNativeDriver: true,
            }),
            Animated.timing(seekTimerOpacity, {
                toValue: 0,
                duration: SEEK_TIMER_ANIM_DURATION,
                useNativeDriver: true,
            }),
        ]).start();
    }).current;

    const showSeekDescTimerTransition = useRef(() => {
        descOpacity.setValue(0);
        seekTimerOpacity.setValue(1);
    }).current;

    onSeekRef.current = onSeek;
    progressRef.current = progress;

    const displayProgress =
        seekingProgress !== null ? seekingProgress : progress;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => !!onSeekRef.current,
            onStartShouldSetPanResponderCapture: () => !!onSeekRef.current,
            onMoveShouldSetPanResponder: () => !!onSeekRef.current,
            onPanResponderGrant: (evt) => {
                const seek = onSeekRef.current;
                if (!seek) return;
                isDraggingRef.current = false;
                const { locationX } = evt.nativeEvent;
                const { width: trackW } = trackLayoutRef.current;
                const p =
                    trackW > 0
                        ? Math.max(0, Math.min(1, locationX / trackW))
                        : progressRef.current;
                setSeekingProgress(p);
                seek(p);
                setSeekingRef.current(true);
                showSeekDescTimerTransition();
            },
            onPanResponderMove: (evt) => {
                const seek = onSeekRef.current;
                if (!seek) return;
                if (!isDraggingRef.current) {
                    isDraggingRef.current = true;
                    Animated.timing(trackScaleY, {
                        toValue: SEEK_TRACK_SCALE_DRAG,
                        duration: SEEK_TRACK_ANIM_DURATION,
                        useNativeDriver: true,
                    }).start();
                }
                const moveX = evt.nativeEvent.pageX;
                const { x: trackX, width: trackW } = trackLayoutRef.current;
                const p =
                    trackW > 0
                        ? Math.max(0, Math.min(1, (moveX - trackX) / trackW))
                        : progressRef.current;
                setSeekingProgress(p);
                seek(p);
            },
            onPanResponderRelease: () => {
                setSeekingProgress(null);
                hideSeekState();
            },
            onPanResponderTerminate: () => {
                setSeekingProgress(null);
                hideSeekState();
            },
        }),
    ).current;

    useEffect(() => {
        if (isVisible) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            fadeAnim.setValue(0);
        }
    }, [isVisible, fadeAnim]);

    useEffect(() => {
        if (isPaused && isVisible) {
            Animated.timing(playButtonAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(playButtonAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [isPaused, isVisible, playButtonAnim]);

    if (!isVisible) {
        return null;
    }

    return (
        <Animated.View
            style={[
                styles.overlayContainer,
                { opacity: fadeAnim, paddingBottom: bottomPadding },
            ]}
            pointerEvents="box-none"
        >
            <Animated.View
                style={[
                    styles.playButtonContainer,
                    {
                        opacity: playButtonAnim,
                        transform: [
                            { translateX: -PLAY_BUTTON_HALF },
                            { translateY: -PLAY_BUTTON_HALF },
                        ],
                    },
                ]}
                pointerEvents="none"
            >
                <View style={styles.playButtonHalo}>
                    <Ionicons name="play" size={54} color={katechonTheme.bg} />
                </View>
            </Animated.View>

            <View style={styles.topRail} pointerEvents="box-none">
                <View style={styles.brandCluster}>
                    <Text style={styles.brand}>KATECHON</Text>
                    <View style={styles.livePill}>
                        <View style={styles.liveDot} />
                        <Text style={styles.liveText}>{video.cadence}</Text>
                    </View>
                </View>
                <Text style={styles.deckLabel} numberOfLines={1}>
                    {video.workspace}
                </Text>
            </View>

            <View style={styles.scanFrame} pointerEvents="none">
                <View
                    style={[
                        styles.corner,
                        styles.cornerTopLeft,
                        { borderColor: video.accent },
                    ]}
                />
                <View
                    style={[
                        styles.corner,
                        styles.cornerBottomRight,
                        { borderColor: video.accent },
                    ]}
                />
                <View style={styles.verticalRule} />
            </View>

            <View style={[styles.operatorRail, { bottom: rightColumnBottom }]}>
                <View
                    style={[
                        styles.avatarPlaceholder,
                        { borderColor: video.accent },
                    ]}
                >
                    <Text style={styles.avatarText}>K</Text>
                </View>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons
                        name="radio"
                        size={RIGHT_ICON_SIZE - 7}
                        color={video.accent}
                    />
                    <Text style={styles.iconLabel}>{video.signal}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton}>
                    <Ionicons
                        name="analytics"
                        size={RIGHT_ICON_SIZE - 6}
                        color={katechonTheme.text}
                    />
                    <Text style={styles.iconLabel}>{video.confidence}%</Text>
                </TouchableOpacity>
                {PERFORMANCE_MONITOR_ENABLED && (
                    <TouchableOpacity
                        style={styles.iconButton}
                        onPress={toggleMetrics}
                    >
                        <MaterialCommunityIcons
                            name="chart-timeline-variant"
                            size={RIGHT_ICON_SIZE - 5}
                            color={katechonTheme.cyan}
                        />
                        <Text style={styles.iconLabel}>TTFF</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View
                ref={seekTrackRef}
                pointerEvents="box-only"
                style={[
                    styles.seekBarHitAreaSticky,
                    {
                        bottom: seekBarBottom,
                        left: -OVERLAY_HORIZONTAL_PADDING,
                        right: -OVERLAY_HORIZONTAL_PADDING,
                    },
                ]}
                onLayout={(e) => {
                    const { width } = e.nativeEvent.layout;
                    if (width > 0) {
                        trackLayoutRef.current.width = width;
                    }
                    seekTrackRef.current?.measureInWindow((x, _y, w) => {
                        if (w > 0) {
                            trackLayoutRef.current = { x, width: w };
                        }
                    });
                }}
                {...(onSeek ? panResponder.panHandlers : {})}
            >
                <Animated.View
                    style={[
                        styles.seekBarTrack,
                        {
                            transform: [{ scaleY: trackScaleY }],
                        },
                    ]}
                >
                    <View
                        style={[
                            styles.seekBarFill,
                            {
                                width: `${
                                    Math.min(1, Math.max(0, displayProgress)) *
                                    100
                                }%`,
                            },
                        ]}
                    />
                </Animated.View>
            </View>

            <Animated.View
                pointerEvents="none"
                style={[
                    styles.seekTimer,
                    {
                        bottom:
                            seekBarBottom +
                            SEEK_BAR_AREA_HEIGHT +
                            SEEK_TIMER_OFFSET_ABOVE_BAR,
                        opacity: seekTimerOpacity,
                    },
                ]}
            >
                <Text style={styles.seekTimerText}>
                    {formatSeekTime(
                        displayProgress * (duration > 0 ? duration : 0),
                    )}
                    {" / "}
                    {formatSeekTime(duration > 0 ? duration : 0)}
                </Text>
            </Animated.View>

            <Animated.View
                style={[
                    styles.bottomSection,
                    {
                        marginBottom: BOTTOM_SECTION_MARGIN,
                        opacity: descOpacity,
                    },
                ]}
            >
                <View style={styles.captionArea}>
                    <View style={styles.captionHeader}>
                        <Text style={styles.captionKicker}>
                            {video.operator} / {video.lens}
                        </Text>
                        <View
                            style={[
                                styles.signalPill,
                                { borderColor: video.accent },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.signalPillText,
                                    { color: video.accent },
                                ]}
                            >
                                {video.signal}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.captionTitle} numberOfLines={1}>
                        {video.title}
                    </Text>
                    <Text style={styles.captionDesc} numberOfLines={3}>
                        {video.briefing}
                    </Text>
                    <View style={styles.microGrid}>
                        <Text style={styles.microText}>HLS READY</Text>
                        <Text style={styles.microText}>VOICE ROUTER</Text>
                        <Text style={styles.microText}>REMOTE OS</Text>
                    </View>
                </View>
            </Animated.View>
        </Animated.View>
    );
};

export const styles = StyleSheet.create({
    overlayContainer: {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: "flex-end",
        alignItems: "flex-end",
        paddingLeft: OVERLAY_HORIZONTAL_PADDING,
        paddingRight: OVERLAY_HORIZONTAL_PADDING,
        zIndex: 25,
    },
    topRail: {
        position: "absolute",
        top: Platform.OS === "android" ? 32 : 58,
        left: 18,
        right: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 12,
    },
    brandCluster: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    brand: {
        color: katechonTheme.text,
        fontSize: 13,
        fontWeight: "800",
        letterSpacing: 2,
    },
    livePill: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        borderWidth: 1,
        borderColor: katechonTheme.lineHot,
        backgroundColor: "rgba(0,232,123,0.08)",
        borderRadius: 5,
        paddingHorizontal: 8,
        paddingVertical: 5,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: katechonTheme.green,
    },
    liveText: {
        color: katechonTheme.green,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 10,
        letterSpacing: 1,
        fontWeight: "700",
    },
    deckLabel: {
        color: katechonTheme.muted,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 11,
        letterSpacing: 1.4,
        textTransform: "uppercase",
        maxWidth: SCREEN_WIDTH * 0.42,
    },
    scanFrame: {
        position: "absolute",
        top: Platform.OS === "android" ? 82 : 110,
        left: 18,
        right: 18,
        bottom: 132,
        borderWidth: 1,
        borderColor: "rgba(242,244,247,0.06)",
    },
    corner: {
        position: "absolute",
        width: 44,
        height: 44,
    },
    cornerTopLeft: {
        top: -1,
        left: -1,
        borderTopWidth: 2,
        borderLeftWidth: 2,
    },
    cornerBottomRight: {
        right: -1,
        bottom: -1,
        borderRightWidth: 2,
        borderBottomWidth: 2,
    },
    verticalRule: {
        position: "absolute",
        top: 20,
        bottom: 20,
        left: 12,
        width: 1,
        backgroundColor: "rgba(242,244,247,0.10)",
    },
    operatorRail: {
        position: "absolute",
        right: 16,
        justifyContent: "flex-end",
        alignItems: "center",
        gap: 13,
        zIndex: 10,
    },
    iconButton: {
        alignItems: "center",
        justifyContent: "center",
        minWidth: 48,
        minHeight: 48,
        borderWidth: 1,
        borderColor: katechonTheme.line,
        borderRadius: 7,
        backgroundColor: "rgba(5,6,8,0.46)",
    },
    avatarPlaceholder: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: 7,
        backgroundColor: katechonTheme.panelStrong,
        borderWidth: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    avatarText: {
        color: katechonTheme.text,
        fontSize: 18,
        fontWeight: "800",
    },
    iconLabel: {
        color: katechonTheme.muted,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 9,
        marginTop: 3,
        fontWeight: "700",
        letterSpacing: 0.5,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    playButtonContainer: {
        position: "absolute",
        top: SCREEN_HEIGHT / 2,
        left: SCREEN_WIDTH / 2,
        width: PLAY_BUTTON_SIZE,
        height: PLAY_BUTTON_SIZE,
        borderRadius: PLAY_BUTTON_HALF,
        justifyContent: "center",
        alignItems: "center",
    },
    playButtonHalo: {
        width: PLAY_BUTTON_SIZE,
        height: PLAY_BUTTON_SIZE,
        borderRadius: PLAY_BUTTON_HALF,
        backgroundColor: "rgba(0,232,123,0.86)",
        borderWidth: 1,
        borderColor: "rgba(217,255,233,0.66)",
        justifyContent: "center",
        alignItems: "center",
    },
    bottomSection: {
        alignSelf: "stretch",
    },
    seekBarHitAreaSticky: {
        position: "absolute",
        paddingVertical: SEEK_BAR_HIT_SLOP,
    },
    seekBarTrack: {
        height: SEEK_BAR_HEIGHT,
        backgroundColor: "rgba(242,244,247,0.22)",
        borderRadius: SEEK_BAR_HEIGHT / 2,
        overflow: "hidden",
    },
    seekBarFill: {
        height: "100%",
        backgroundColor: katechonTheme.green,
        borderRadius: SEEK_BAR_HEIGHT / 2,
    },
    seekTimer: {
        position: "absolute",
        alignSelf: "center",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: katechonTheme.panelStrong,
        borderWidth: 1,
        borderColor: katechonTheme.lineHot,
        borderRadius: 8,
    },
    seekTimerText: {
        color: katechonTheme.text,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 20,
        fontWeight: "600",
    },
    captionArea: {
        width: Math.min(SCREEN_WIDTH - 104, 430),
        padding: 14,
        paddingRight: 16,
        borderWidth: 1,
        borderColor: katechonTheme.line,
        borderRadius: 8,
        backgroundColor: katechonTheme.panel,
    },
    captionHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        marginBottom: 8,
    },
    captionKicker: {
        color: katechonTheme.soft,
        flex: 1,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 10,
        letterSpacing: 1.3,
        textTransform: "uppercase",
    },
    signalPill: {
        borderWidth: 1,
        borderRadius: 5,
        paddingHorizontal: 7,
        paddingVertical: 4,
        backgroundColor: "rgba(5,6,8,0.36)",
    },
    signalPillText: {
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 9,
        fontWeight: "800",
        letterSpacing: 1,
    },
    captionTitle: {
        color: katechonTheme.text,
        fontSize: 27,
        lineHeight: 31,
        fontWeight: "800",
        marginBottom: 7,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    captionDesc: {
        color: katechonTheme.muted,
        fontSize: 13,
        lineHeight: 18,
        textShadowColor: "rgba(0,0,0,0.8)",
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    microGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 12,
    },
    microText: {
        color: katechonTheme.green,
        fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
        fontSize: 9,
        letterSpacing: 0.8,
        borderWidth: 1,
        borderColor: "rgba(0,232,123,0.28)",
        borderRadius: 4,
        paddingHorizontal: 6,
        paddingVertical: 4,
        backgroundColor: "rgba(0,232,123,0.07)",
    },
});

export default VideoOverlay;
