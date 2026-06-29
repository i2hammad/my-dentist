import React, { useMemo, useRef, useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Platform, Image,
  ScrollView, useWindowDimensions, Animated, PanResponder,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import imgUrl from '../config/imgUrl';

const isWeb = Platform.OS === 'web';
const WebView = isWeb ? null : require('react-native-webview').WebView;

const TIER_COLOR = { elite: '#7C3AED', modern: '#0066FF', standard: '#0D9488' };
const tierColor = (t) => TIER_COLOR[String(t || '').toLowerCase()] || '#0066FF';

const parseCoords = (s) => {
  if (!s) return null;
  const parts = String(s).split(',').map((n) => parseFloat(n.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  return { lat: parts[0], lng: parts[1] };
};

const haversineKm = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const fmtKm = (km) => (km == null ? null : km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

// --- Open / Closed -----------------------------------------------------------
// Timings come in mixed formats ("09:00", "2:00", "05:00 PM"). Be tolerant.
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const toMinutes = (raw) => {
  if (!raw) return null;
  let s = String(raw).trim().toUpperCase();
  const pm = s.includes('PM');
  const am = s.includes('AM');
  s = s.replace(/AM|PM/g, '').trim();
  const [hStr, mStr] = s.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || '0', 10);
  if (isNaN(h)) return null;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  return h * 60 + (isNaN(m) ? 0 : m);
};
const isOpenNow = (timing, now) => {
  if (!timing) return null;
  const dayName = DAY_ABBR[now.getDay()];
  const available = timing.availableDays;
  const off = timing.offDays;
  if (Array.isArray(off) && off.includes(dayName)) return false;
  if (Array.isArray(available) && available.length && !available.includes(dayName)) return false;
  const mins = now.getHours() * 60 + now.getMinutes();
  const windows = [
    [toMinutes(timing.morningStart), toMinutes(timing.morningEnd)],
    [toMinutes(timing.eveningStart), toMinutes(timing.eveningEnd)],
    [toMinutes(timing.startTime), toMinutes(timing.endTime)],
  ].filter(([a, b]) => a != null && b != null);
  if (!windows.length) return null;
  return windows.some(([a, b]) => (b >= a ? mins >= a && mins <= b : mins >= a || mins <= b));
};

const buildHtml = (points, center, patientCoords) => {
  const markerData = JSON.stringify(points);
  const patientJs = patientCoords
    ? `userMarker = L.circleMarker([${patientCoords.lat}, ${patientCoords.lng}], {radius:9,color:'#fff',weight:3,fillColor:'#2563EB',fillOpacity:1}).addTo(map);
       L.circle([${patientCoords.lat}, ${patientCoords.lng}], {radius:600,color:'#2563EB',weight:1,fillColor:'#2563EB',fillOpacity:.08}).addTo(map);`
    : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    html,body,#map{height:100%;margin:0;padding:0;background:#E8EEF6;}
    .leaflet-control-attribution{font-size:9px;opacity:.6;}
    .pin{position:relative;width:44px;height:56px;transition:transform .18s cubic-bezier(.2,.8,.2,1);transform-origin:bottom center;}
    .pin .body{position:absolute;top:0;left:0;width:44px;height:44px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);box-shadow:0 5px 12px rgba(15,23,42,.35);border:3px solid #fff;}
    .pin .photo{position:absolute;top:6px;left:6px;width:32px;height:32px;border-radius:50%;
      background-size:cover;background-position:center;background-color:#e2e8f0;border:1.5px solid #fff;}
    .pin .ph-fallback{display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:15px;}
    .pin.sel{transform:scale(1.32);z-index:1000;}
    .leaflet-marker-icon{background:transparent;border:none;}
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var pts = ${markerData};
    var markers = {}, userMarker = null;
    function send(o){var m=JSON.stringify(o);
      if(window.ReactNativeWebView){window.ReactNativeWebView.postMessage(m);}
      else if(window.parent){window.parent.postMessage(m,'*');}}
    function iconHtml(p){
      var inner = p.photo
        ? '<div class="photo" style="background-image:url(\\''+p.photo+'\\')"></div>'
        : '<div class="photo ph-fallback" style="transform:rotate(45deg);background:'+p.color+'">'+(p.initial||'D')+'</div>';
      return '<div class="pin" id="pin-'+p.id+'"><div class="body" style="background:'+p.color+'"></div>'+inner+'</div>';
    }
    var map = L.map('map',{zoomControl:false,attributionControl:true}).setView([${center.lat}, ${center.lng}], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(map);
    ${patientJs}
    pts.forEach(function(p){
      var ic=L.divIcon({className:'',html:iconHtml(p),iconSize:[44,56],iconAnchor:[8,54]});
      var m=L.marker([p.lat,p.lng],{icon:ic}).addTo(map);
      m.on('click',function(){select(p.id,true);send({type:'select',id:p.id});});
      markers[p.id]=m;
    });
    var selId=null;
    function select(id,skipFly){
      if(selId){var pe=document.getElementById('pin-'+selId);if(pe)pe.classList.remove('sel');}
      selId=id;
      var el=document.getElementById('pin-'+id);if(el)el.classList.add('sel');
      var mk=markers[id];
      if(mk&&!skipFly){map.flyTo(mk.getLatLng(),Math.max(map.getZoom(),14),{duration:.5});}
    }
    function recenter(lat,lng){ map.flyTo([lat,lng], 14, {duration:.6}); }
    function setUser(lat,lng){
      if(userMarker){ userMarker.setLatLng([lat,lng]); }
      else { userMarker = L.circleMarker([lat,lng],{radius:9,color:'#fff',weight:3,fillColor:'#2563EB',fillOpacity:1}).addTo(map); }
    }
    document.addEventListener('message',onHost); window.addEventListener('message',onHost);
    function onHost(e){try{var d=JSON.parse(e.data);
      if(d.type==='select'){select(d.id);}
      else if(d.type==='recenter'){ setUser(d.lat,d.lng); recenter(d.lat,d.lng); }
    }catch(err){}}
    // Default view: zoom to the patient's location if we have it; otherwise fit all pins.
    var hasUser = ${patientCoords ? 'true' : 'false'};
    if(hasUser){ map.setView([${center.lat}, ${center.lng}], 14); }
    else { try{if(pts.length>1){var g=L.featureGroup(pts.map(function(p){return L.marker([p.lat,p.lng]);}));map.fitBounds(g.getBounds().pad(0.25));}}catch(e){} }
  </script>
</body>
</html>`;
};

export default function MapScreen({ navigation, route }) {
  const doctors = route.params?.doctors || [];
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const iframeRef = useRef(null);
  const webviewRef = useRef(null);
  const listRef = useRef(null);

  const [patientCoords, setPatientCoords] = useState(route.params?.patientCoords || null);
  const [selId, setSelId] = useState(null);
  const now = useMemo(() => new Date(), []);

  // ---- Bottom sheet geometry ----
  const SHEET_MIN = 150;                                   // collapsed peek height
  const SHEET_MAX = Math.min(height * 0.7, height - insets.top - 70);
  const translateY = useRef(new Animated.Value(0)).current; // 0 = collapsed (sheet low)
  const expandedRef = useRef(false);
  const snapTo = useCallback((expanded) => {
    expandedRef.current = expanded;
    Animated.spring(translateY, {
      toValue: expanded ? -(SHEET_MAX - SHEET_MIN) : 0,
      useNativeDriver: true, bounciness: 4, speed: 14,
    }).start();
  }, [SHEET_MAX]);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderMove: (_, g) => {
        const base = expandedRef.current ? -(SHEET_MAX - SHEET_MIN) : 0;
        let next = base + g.dy;
        next = Math.max(-(SHEET_MAX - SHEET_MIN), Math.min(0, next));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy < -40 || g.vy < -0.5) snapTo(true);
        else if (g.dy > 40 || g.vy > 0.5) snapTo(false);
        else snapTo(expandedRef.current);
      },
    })
  ).current;

  const points = useMemo(
    () =>
      doctors
        .map((d) => {
          const c = parseCoords(d.coordinates);
          if (!c) return null;
          return {
            id: String(d._id),
            color: tierColor(d.clinicTier),
            initial: (d.fullName || 'D').replace(/^dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || 'D',
            photo: d.photo ? imgUrl(d.photo) : '',
            ...c,
          };
        })
        .filter(Boolean),
    [doctors]
  );
  // Plotted doctors, sorted nearest-first when we know the patient's location.
  const plotted = useMemo(() => {
    const list = doctors.filter((d) => parseCoords(d.coordinates));
    if (!patientCoords) return list;
    const distOf = (d) => {
      const c = parseCoords(d.coordinates);
      const km = c ? haversineKm(patientCoords.lat, patientCoords.lng, c.lat, c.lng) : null;
      return km == null ? Infinity : km;
    };
    return [...list].sort((a, b) => distOf(a) - distOf(b));
  }, [doctors, patientCoords]);
  const center = patientCoords || points[0] || { lat: 30.3753, lng: 69.3451 };
  const html = useMemo(() => buildHtml(points, center, patientCoords), [points]); // eslint-disable-line

  const postToMap = useCallback((msg) => {
    const json = JSON.stringify(msg);
    if (isWeb) iframeRef.current?.contentWindow?.postMessage(json, '*');
    else webviewRef.current?.postMessage(json);
  }, []);

  const onMapSelect = useCallback((id) => {
    setSelId(String(id));
    if (!expandedRef.current) snapTo(true);
    const i = plotted.findIndex((d) => String(d._id) === String(id));
    if (i >= 0) listRef.current?.scrollTo({ y: i * 96, animated: true });
  }, [plotted, snapTo]);

  const selectDoctor = useCallback((doc) => {
    setSelId(String(doc._id));
    postToMap({ type: 'select', id: String(doc._id) });
  }, [postToMap]);

  // ---- My location button ----
  const goToMyLocation = useCallback(async () => {
    try {
      if (patientCoords) {
        postToMap({ type: 'recenter', ...patientCoords });
      }
      if (isWeb) return; // geolocation prompt is unreliable inside iframe; use stored coords
      const Location = require('expo-location');
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPatientCoords(coords);
      postToMap({ type: 'recenter', ...coords });
    } catch {}
  }, [patientCoords, postToMap]);

  useEffect(() => {
    if (!isWeb) return;
    const handler = (e) => {
      try { const msg = JSON.parse(e.data); if (msg?.type === 'select') onMapSelect(msg.id); } catch {}
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [onMapSelect]);

  // On mount (phone): if we don't already have the patient's location, grab the
  // live device location so the map defaults to "my location".
  useEffect(() => {
    if (isWeb || patientCoords) return;
    let cancelled = false;
    (async () => {
      try {
        const Location = require('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPatientCoords(coords);
        postToMap({ type: 'recenter', ...coords });
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line

  const renderRow = (doc, i) => {
    const dc = parseCoords(doc.coordinates);
    const km = patientCoords && dc ? haversineKm(patientCoords.lat, patientCoords.lng, dc.lat, dc.lng) : null;
    const accent = tierColor(doc.clinicTier);
    const open = isOpenNow(doc.clinicTiming, now);
    const selected = selId === String(doc._id);
    return (
      <TouchableOpacity
        key={doc._id || i}
        activeOpacity={0.85}
        onPress={() => { selectDoctor(doc); navigation.navigate('DoctorProfile', { doctor: doc }); }}
        onPressIn={() => selectDoctor(doc)}
        style={[styles.row, selected && { backgroundColor: '#F5F8FF' }]}
      >
        {doc.photo ? (
          <Image source={{ uri: imgUrl(doc.photo) }} style={styles.rowPhoto} />
        ) : (
          <View style={[styles.rowPhoto, { backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={styles.rowInitial}>{(doc.fullName || 'D').charAt(0)}</Text>
          </View>
        )}
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.rowName} numberOfLines={1}>{doc.fullName}</Text>
            {doc.pmdcVerified && <Ionicons name="checkmark-circle" size={14} color="#0066FF" style={{ marginLeft: 4 }} />}
          </View>
          <Text style={styles.rowSpec} numberOfLines={1}>{doc.specialization || 'Dentist'}</Text>
          <View style={styles.rowMetaLine}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={styles.rowMeta}>{doc.avgRating?.toFixed(1) || '0.0'}</Text>
            {km != null && (<><View style={styles.dot} /><Ionicons name="location-outline" size={11} color="#64748B" /><Text style={styles.rowMeta}>{fmtKm(km)}</Text></>)}
            {open != null && (
              <>
                <View style={styles.dot} />
                <Text style={[styles.openTxt, { color: open ? '#16A34A' : '#DC2626' }]}>{open ? 'Open' : 'Closed'}</Text>
              </>
            )}
          </View>
          {!!doc.clinicName && (
            <Text style={styles.rowClinic} numberOfLines={1}><Ionicons name="business-outline" size={11} color="#94A3B8" /> {doc.clinicName}</Text>
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
      </TouchableOpacity>
    );
  };

  const mapEl =
    points.length === 0 ? (
      <View style={styles.empty}><Ionicons name="map-outline" size={48} color="#CBD5E1" /><Text style={styles.emptyText}>No doctor locations available to map.</Text></View>
    ) : isWeb ? (
      <iframe ref={iframeRef} title="map" srcDoc={html} style={{ border: 'none', width: '100%', height: '100%' }} />
    ) : (
      <WebView
        ref={webviewRef} originWhitelist={['*']} source={{ html }} style={{ flex: 1, backgroundColor: '#E8EEF6' }}
        onMessage={(e) => { try { const msg = JSON.parse(e.nativeEvent.data); if (msg?.type === 'select') onMapSelect(msg.id); } catch {} }}
      />
    );

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill}>{mapEl}</View>

      {/* Top floating bar */}
      <SafeAreaView edges={['top']} style={styles.floatTop} pointerEvents="box-none">
        <View style={styles.floatBar} pointerEvents="box-none">
          <TouchableOpacity style={styles.fab} onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#0F172A" />
          </TouchableOpacity>
          <View style={styles.countPill}>
            <Ionicons name="navigate" size={13} color="#0066FF" />
            <Text style={styles.countPillTxt}>{points.length} doctor{points.length === 1 ? '' : 's'} nearby</Text>
          </View>
          <View style={{ width: 42 }} />
        </View>
      </SafeAreaView>

      {/* My-location button — floats just above the collapsed sheet */}
      {points.length > 0 && (
        <TouchableOpacity
          style={[styles.locBtn, { bottom: SHEET_MIN + 16 + insets.bottom }]}
          onPress={goToMyLocation}
          activeOpacity={0.85}
        >
          <Ionicons name="locate" size={22} color="#0066FF" />
        </TouchableOpacity>
      )}

      {/* Draggable bottom sheet */}
      {points.length > 0 && (
        <Animated.View
          style={[styles.sheet, { height: SHEET_MAX, bottom: -(SHEET_MAX - SHEET_MIN), transform: [{ translateY }], paddingBottom: insets.bottom }]}
        >
          <View {...pan.panHandlers} style={styles.sheetHead}>
            <View style={styles.grabber} />
            <Text style={styles.sheetTitle}>Nearby Doctors</Text>
            <Text style={styles.sheetSub}>{patientCoords ? 'Sorted by nearest · tap to view profile' : 'Drag up to see all · tap to view profile'}</Text>
          </View>
          <ScrollView
            ref={listRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
          >
            {plotted.map((doc, i) => renderRow(doc, i))}
          </ScrollView>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#E8EEF6' },

  floatTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  floatBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 },
  fab: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  countPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 22, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  countPillTxt: { marginLeft: 6, fontWeight: '700', fontSize: 13, color: '#0F172A' },

  locBtn: { position: 'absolute', right: 16, width: 46, height: 46, borderRadius: 23, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#FFFFFF' },
  emptyText: { marginTop: 12, color: '#64748B', fontSize: 14, textAlign: 'center' },

  sheet: {
    position: 'absolute', left: 0, right: 0, backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 16,
  },
  sheetHead: { paddingTop: 10, paddingHorizontal: 20, paddingBottom: 8 },
  grabber: { alignSelf: 'center', width: 42, height: 5, borderRadius: 3, backgroundColor: '#E2E8F0', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sheetSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#F4F6FA' },
  rowPhoto: { width: 54, height: 54, borderRadius: 14, backgroundColor: '#E2E8F0' },
  rowInitial: { color: '#FFFFFF', fontWeight: '800', fontSize: 20 },
  rowName: { fontSize: 15, fontWeight: '800', color: '#0F172A', flexShrink: 1 },
  rowSpec: { fontSize: 12.5, color: '#64748B', marginTop: 1 },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  rowMeta: { fontSize: 12, color: '#334155', marginLeft: 3, fontWeight: '600' },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: '#CBD5E1', marginHorizontal: 7 },
  openTxt: { fontSize: 12, fontWeight: '800' },
  rowClinic: { fontSize: 11.5, color: '#94A3B8', marginTop: 3 },
});
