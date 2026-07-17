import pangea from "@twc/pangea-web";
import type { SunFeatureSourceOptions } from "@twc/pangea-web/sources/SunFeatureSource";
import type { SunVectorSourceOptions } from "@twc/pangea-web/sources/SunVectorSource";
import type { SunGridSourceOptions } from "@twc/pangea-web/sources/SunGridSource";
import type { FeatureLayerOptions } from "@twc/pangea-web/layers/FeatureLayer";
import type { VectorLayerOptions } from "@twc/pangea-web/layers/VectorLayer";
import type { GridLayerOptions } from "@twc/pangea-web/layers/GridLayer";
import type { GridRasterStyleOptions } from "@twc/pangea-web/visuals/GridRasterStyle";
import type { PaletteLike } from "@twc/pangea-web/visuals/Palette";
import type { Distance } from "@twc/pangea-web/geography/Distance";
import type { SunPackedSourceOptions } from "@twc/pangea-web/sources/SunPackedSource";
import type { PackedLayerOptions } from "@twc/pangea-web/layers/PackedLayer";

// Type imports
type Feature = typeof pangea.data.Feature.prototype;
type Indexer<T> = { [key: string]: T };
type GridRasterStyle = typeof pangea.visuals.GridRasterStyle.prototype;
type GridContourStyle = typeof pangea.visuals.GridContourStyle.prototype;

// Local imports
import { Settings } from "../Settings";
import { SunUtility } from "../SunUtility";
import { SunVectorConfiguration, SunVectorPreset } from "../SunVectorPreset";
import { SunFeatureConfiguration, SunFeaturePreset } from "../SunFeaturePreset";
import { SunGridConfiguration, SunGridPreset } from "../SunGridPreset";
import { SunPackedConfiguration, SunPackedPreset } from "../SunPackedPreset";

//#region Palettes

export const AviationPalettes: Indexer<PaletteLike> = {
	// EDR (Eddy Dissipation Rate) turbulence — values are a small 0–~0.5 range (observed ~0–0.1
	// in smooth air), NOT the 0–7 index of the GTG grid. LINEAR with low-end stops + extended
	// maximum so pervasive light turbulence still renders instead of falling on a transparent step.
	// Used by the EDR flight-level pack only; the GTG pack is a 0–7 severity index and uses the
	// "maverick-turbulence" palette instead.
	"edr-turbulence": {
		colors: [
			{ value: 0.0,  color: [0,   0,   0,   0],    label: "None"            },
			{ value: 0.02, color: [120, 200, 120, 0.45], label: "Smooth"          },
			{ value: 0.10, color: [255, 205, 46,  0.85], label: "Light"           },
			{ value: 0.20, color: [255, 156, 0,   0.95], label: "Light–Moderate"  },
			{ value: 0.35, color: [255, 119, 1,   1],    label: "Moderate"        },
			{ value: 0.45, color: [226, 72,  0,   1],    label: "Moderate–Severe" },
			{ value: 0.70, color: [160, 0,   80,  1],    label: "Severe"          },
		],
		options: {
			id: "Turbulence (EDR)",
			interpolation: "LINEAR",
			minimumColorExtended: false,
			maximumColorExtended: true,
			precision: 2,
		}
	},
	// Contrail formation — a CATEGORICAL field (measured values 0/1/2): 0 none, 1 non-persistent,
	// 2 persistent. NONE interpolation so each category maps to its own ice/cirrus blue tone
	// instead of being blended; data only exists at high flight levels (~FL300+).
	"contrail-risk": {
		colors: [
			{ value: 0, color: [0,   0,   0,   0],    label: "None"           },
			{ value: 1, color: [120, 190, 235, 0.75], label: "Non-persistent" },
			{ value: 2, color: [40,  110, 220, 0.95], label: "Persistent"     },
		],
		options: {
			id: "Contrail Risk",
			interpolation: "NONE",
			minimumColorExtended: false,
			maximumColorExtended: true,
			precision: 0,
		}
	},
	"high-ice-water-content-cm": {
		colors: [
			{ value: 1.0, color: { red: 204, green: 0, blue: 204, alpha: 1 } },
			{ value: 2.0, color: { red: 255, green: 201, blue: 255, alpha: 1 } },
			{ value: 3.0, color: { red: 255, green: 204, blue: 229, alpha: 1 } },
		],
		options: {
			id: "High Ice Water Content",
			interpolation: "NONE",
			minimumColorExtended: false,
			maximumColorExtended: true,
			precision: 2,
		}
	},
	"maverick-turbulence": {
		colors: [
			{ value: 0, color: { red: 0,   green: 0,   blue: 0,   alpha: 0 } },
			{ value: 1, color: { red: 255, green: 205, blue: 46,  alpha: 1 } },
			{ value: 2, color: { red: 255, green: 205, blue: 46,  alpha: 1 } },
			{ value: 3, color: { red: 255, green: 156, blue: 0,   alpha: 1 } },
			{ value: 4, color: { red: 255, green: 119, blue: 1,   alpha: 1 } },
			{ value: 5, color: { red: 226, green: 72,  blue: 0,   alpha: 1 } },
			{ value: 6, color: { red: 226, green: 72,  blue: 0,   alpha: 1 } },
			{ value: 7, color: { red: 226, green: 72,  blue: 0,   alpha: 1 } },
		],
		options: {
			id: "Turbulence (Maverick)",
			interpolation: "NONE",
			minimumColorExtended: false,
			maximumColorExtended: false,
			precision: 0,
		}
	},
	"icing-potential": {
		colors: [
			{ value: 0,    color: [0,   0,   0,   0], label: "None"             },  // 0%   transparent
			{ value: 0.1,  color: [0,   180, 255, 1], label: "Trace"            },  // 10%  sky blue
			{ value: 0.25, color: [0,   230, 160, 1], label: "Light"            },  // 25%  cyan-green
			{ value: 0.4,  color: [0,   200,  50, 1], label: "Light–Moderate"   },  // 40%  green
			{ value: 0.55, color: [240, 220,   0, 1], label: "Moderate"         },  // 55%  yellow
			{ value: 0.7,  color: [255, 140,   0, 1], label: "Moderate–Severe"  },  // 70%  orange
			{ value: 0.85, color: [220,  20,   0, 1], label: "Severe"           },  // 85%  red
			{ value: 1.0,  color: [180,   0, 120, 1], label: "Extreme"          },  // 100% dark magenta
		],
		options: {
			id: "Icing Potential (AWC/FIP)",
			interpolation: "LINEAR",
			units: "probability (0–1)",
		}
	},
	"icing-potential-fip": {
		colors: [
			{ value: 0,    color: [0,   0,   0,   0] },
			{ value: 0.20, color: [51,  225, 225, 1] },
			{ value: 0.4,  color: [26,  125, 251, 1] },
			{ value: 0.8,  color: [101, 51,  150, 1] },
			{ value: 1.0,  color: [101, 51,  150, 1] },
		],
		options: {
			id: "Icing Potential (FIP)",
			interpolation: "LINEAR",
			minimumColorExtended: false,
			maximumColorExtended: true,
			units: "probability (0–1)",
		}
	},
};

//#endregion

//#region Properties

export type AirmetGovernmentProperties = {
	showConvective?: boolean;
	showDust?: boolean;
	showIcing?: boolean;
	showSand?: boolean;
	showSurfaceWind?: boolean;
	showTurbulence?: boolean;
	showVisibility?: boolean;
	showVolcanicAsh?: boolean;
}

export type SigmetsGovernmentProperties = {
	showConvective?: number;
	showDust?: boolean;
	showIcing?: boolean;
	showSand?: boolean;
	showSurfaceWind?: boolean;
	showTurbulence?: boolean;
	showVisibility?: boolean;
	showVolcanicAsh?: boolean;
	rangeMinimum?: number;
	rangeMaximum?: number;
	time?: Date;
	label?: string;
}

export type SigmetsTwcProperties = {
	showConvective?: boolean;
	showDust?: boolean;
	showIcing?: boolean;
	showSpecial?: boolean;
	showTurbulence?: boolean;
	showVisibility?: boolean;
	showVolcanicAsh?: boolean;
}

export type TfrProperties = {
	showPresidential?: boolean;
	showFire?: boolean;
	showOther?: boolean;
}

export type NavaidsProperties = {
	showHigh?:     boolean;  // range_power_class "H" — visible at zoom ≥ 6
	showLow?:      boolean;  // range_power_class "L" — visible at zoom ≥ 7
	showTerminal?: boolean;  // range_power_class "T" — visible at zoom ≥ 8
	showOther?:    boolean;  // range_power_class U/M/" "/" — visible at zoom ≥ 8
}

export type WaypointsProperties = {
	showHigh?:     boolean;  // usage2 "H" or "B" — visible at zoom ≥ 6
	showLow?:      boolean;  // usage2 "L" or "B" — visible at zoom ≥ 7
	showTerminal?: boolean;  // usage2 " " or "T" — visible at zoom ≥ 8
}

export type SignificantWeatherProperties = {
	showJetStream?: boolean;
	showCBAreas?: boolean;
	showTurbulence?: boolean;
	showTropopause?: boolean;
	showVolcanoes?: boolean;
	showTropical?: boolean;
}

export type TurbulenceProperties = {
	flightLevel?: TurbulenceFlightLevels;
	elevationExaggeration?: number;
}

export enum TurbulenceFlightLevels {
	FL010 = "FL010",
	FL020 = "FL020",
	FL030 = "FL030",
	FL040 = "FL040",
	FL050 = "FL050",
	FL060 = "FL060",
	FL070 = "FL070",
	FL080 = "FL080",
	FL090 = "FL090",
	FL100 = "FL100",
	FL110 = "FL110",
	FL120 = "FL120",
	FL130 = "FL130",
	FL140 = "FL140",
	FL150 = "FL150",
	FL160 = "FL160",
	FL170 = "FL170",
	FL180 = "FL180",
	FL190 = "FL190",
	FL200 = "FL200",
	FL210 = "FL210",
	FL220 = "FL220",
	FL230 = "FL230",
	FL240 = "FL240",
	FL250 = "FL250",
	FL260 = "FL260",
	FL270 = "FL270",
	FL280 = "FL280",
	FL290 = "FL290",
	FL300 = "FL300",
	FL310 = "FL310",
	FL320 = "FL320",
	FL330 = "FL330",
	FL340 = "FL340",
	FL350 = "FL350",
	FL360 = "FL360",
	FL370 = "FL370",
	FL380 = "FL380",
	FL390 = "FL390",
	FL400 = "FL400",
	FL410 = "FL410",
	FL420 = "FL420",
	FL430 = "FL430",
	FL440 = "FL440",
	FL450 = "FL450",
	FL460 = "FL460",
	FL470 = "FL470",
	FL480 = "FL480",
	FL490 = "FL490",
	FL500 = "FL500"
}

//#endregion

//#region Sort-index helpers

// Aviation hazard phenomenon priority — higher = more dangerous = drawn on top.
const _SIGMET_PHENOMENON_RANK: Record<string, number> = {
	'VA': 7, 'VASH': 7,            // Volcanic ash — catastrophic
	'CONV': 6,                      // Convection / thunderstorms
	'ICNG': 5, 'ICING': 5,         // Structural icing
	'TURB': 4,                      // Turbulence
	'IFR': 3, 'VIS': 3,            // Low visibility / IFR
	'BLDU': 2, 'DUST': 2, 'SAND': 2, // Dust / sand
	'WIND': 1, 'WINDS': 1,         // Surface winds
	'OZNE': 0, 'SPEC': 0,          // Special / other
};
function _sigmetSortIndex(phenomenon: string, intensityCode?: number): number {
	const rank = _SIGMET_PHENOMENON_RANK[phenomenon] ?? 0;
	return rank * 10 + Math.min(9, Math.max(0, intensityCode ?? 0));
}

// TFR classification priority — Presidential TFRs are most restrictive.
const _TFR_CLASS_RANK: Record<string, number> = { 'PRESIDENTIAL': 3, 'FIRE/SPRAYING/RESCUE': 2 };
function _tfrSortIndex(classification: string): number {
	return _TFR_CLASS_RANK[classification] ?? 1;
}

// Restricted airspace: status (active/pending) × restriction type.
const _AIRSPACE_STATUS_RANK: Record<string, number> = { 'H': 3, 'W': 2, 'P': 1 };
const _AIRSPACE_TYPE_RANK: Record<string, number> = { 'P': 7, 'D': 6, 'R': 5, 'W': 4, 'M': 3, 'A': 2, 'L': 1, 'C': 0 };
function _restrictedAirspaceSortIndex(status: string, restrictionType: string): number {
	return (_AIRSPACE_STATUS_RANK[status] ?? 0) * 10 + (_AIRSPACE_TYPE_RANK[restrictionType] ?? 0);
}

// Significant weather polygon priority — convection above turbulence.
const _SIGWX_CONVECTION_RANK: Record<string, number> = {
	'FREQUENT': 3, 'OCNL': 2, 'OCNL/EMBED': 2, 'ISOL': 1, 'ISOL/EMBED': 1
};
function _sigwxSortIndex(layerName: string, convectionType?: string): number {
	if (layerName === 'CONVECTION') { return 20 + (_SIGWX_CONVECTION_RANK[convectionType] ?? 0); }
	if (layerName === 'TURBULENCE') { return 10; }
	return 0;
}

//#endregion

//#region Vector Presets

export function SpecialUseAirspaceVector(configuration: SunVectorConfiguration): SunVectorPreset {
	
	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6026";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-special-use-airspace-vector-source",
		validity: {
			backward: 0,
			forward: 8640000000000000,
		},
		zoomRange: [0, 7]
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Utility
	const suaAirspaceTypeLabels = {
		A: "ATCAA",
		L: "Alert",
		R: "Restricted",
		P: "Prohibited",
		M: "Military Operations",
		W: "Warning",
	};
	const suaStatusLabels = {
		H: "Active",
		W: "Waiting to Start",
		P: "Pending Approval",
	};
	let formatSuaStartEndDate = function(startTimeStr: string, endTimeStr: string) {
		if (!startTimeStr || !endTimeStr) return null;
		const startTime = new Date(startTimeStr);
		const endTime = new Date(endTimeStr);
		const startDay = startTime.getUTCDate();
		const startHours = startTime.getUTCHours().toString().padStart(2, "0");
		const startMinutes = startTime.getMinutes().toString().padStart(2, "0");
		const endDay = endTime.getUTCDate();
		const endHours = endTime.getUTCHours().toString().padStart(2, "0");
		const endMinutes = endTime.getUTCMinutes().toString().padStart(2, "0");
		// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
		return `${startDay}/${startHours}${startMinutes} - ${endDay}/${endHours}${endMinutes}`;
	}
	let compute = function (feature) {
		const airspaceLabel = suaAirspaceTypeLabels[feature.properties.airspace_type] ?? "Other";
		const statusLabel = suaStatusLabels[feature.properties.status] ?? "Static";
		const suaName = `SUA ${airspaceLabel}: ${feature.properties.airspace_name}`;

		const toolTip = {
			Status: statusLabel,
			FL: `${feature.properties.lower_level} - ${feature.properties.upper_level}`,
			Valid: formatSuaStartEndDate(
				feature.properties.start_time_str,
				feature.properties.end_time_str
			),
		};

		// Setup markup for popup
		const tooltipProperties = Object.entries(toolTip);
		const tooltipElements = tooltipProperties.map(([key, value]) => {
			return value && `<li><field>${key}</field><value>${value}</value>`;
		});
		const popupHTML = `<div><strong>${suaName}</strong><ul>${tooltipElements.join("")}</ul></div>`;

		// Setup markup for details section
		const detailsElements = tooltipProperties.map(([key, value]) => {
			return value && `<li><span>${key}</span><span>${value}</span></li>`;
		});
		const detailsText = `<div class="section-1"><strong>${suaName}</strong><ul class="section-2">${detailsElements.join("")}</ul></div>`;

		// Set up details for copy to clipoard
		// Currently, sua feature data is not populated so we are generating text to copy
		const copyDetailsElements = tooltipProperties.map(([key, value]) => {
			return value && `${key}: ${value}`;
		});
		const dataText = suaName + "\n" + copyDetailsElements.join("\n");
		const data = feature.data || feature.properties.data || dataText;

		const label = feature.properties.airspace_name || "Special Use Airspace";

		return {
			popupText: popupHTML,
			truncatedPopupText: popupHTML,
			className: "sua",
			data: data,
			detailsText,
			label,
			type: "vector",
		};
	}

	// Style
	let style: Array<mapboxgl.Layer> = [
		{
			type: "fill",
			id: "sua_fill",
			filter: ["in", ["get", "status"], ["literal", ["H", "W", "P"]]],
			layout: {
				"fill-sort-key": ["match", ["get", "status"], "H", 1, "W", 2, "P", 3, 0],
			},
			paint: {
				"fill-opacity": 1,
				"fill-emissive-strength": 1,
				"fill-color": [
					"match",
					["get", "status"],
					"H",
					["rgba", 218, 30, 40, 0.25],
					"W",
					["rgba", 255, 131, 43, 0.25],
					"P",
					["rgba", 241, 194, 27, 0.25],
					["rgba", 255, 255, 255, 0.2],
				],
			},
		},
		{
			type: "line",
			id: "sua_line",
			filter: ["in", ["get", "status"], ["literal", ["H", "W", "P"]]],
			layout: {
				"fill-sort-key": ["match", ["get", "status"], "H", 1, "W", 2, "P", 3, 0],
			},
			paint: {
				"line-opacity": 1,
				"line-emissive-strength": 1,
				"line-color": ["rgba", 0, 0, 0, 1],
				"line-width": 1,
			},
		},
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-special-use-airspace-vector-layer",
		isAnimate: false,
		meta: {
			temporalStatus: "static",
			computed: compute
		},
		slot: 1,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	let preset = new SunVectorPreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region Feature Presets

export function SigmetsGovernmentFeature(configuration: SunFeatureConfiguration<SigmetsGovernmentProperties> = {}): SunFeaturePreset<SigmetsGovernmentProperties> {
	configuration = { ...configuration, properties: configuration.properties ?? {} as SigmetsGovernmentProperties };

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6003";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-sigmets-government-feature-source",
		validity: { backward: 3000000000, forward: 3600000000 }
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	const WSI_ISSUED = "KWSI";
	const HAZARD_TEXT = {
					TURB: "Turbulence",
					CONV: "Convective",
					ICING: "Icing",
					VA: "Volcanic Ash",
					DUST: "Blowing Dust",
					SAND: "Sand",
					WINDS: "Winds",
					VIS: "Visibility",
					SPEC: "Special",
	}
	function compute (feature: Feature) {
		var direction = "";
		if (feature.properties.moving_dir) {
			switch (feature.properties.moving_dir) {
				case "0":
					direction = "N";
					break;
				case "22.5":
					direction = "NNE";
					break;
				case "45":
					direction = "NE";
					break;
				case "67.5":
					direction = "ENE";
					break;
				case "90":
					direction = "E";
					break;
				case "112.5":
					direction = "ESE";
					break;
				case "135":
					direction = "SE";
					break;
				case "157.5":
					direction = "SSE";
					break;
				case "180":
					direction = "S";
					break;
				case "202.5":
					direction = "SSW";
					break;
				case "225":
					direction = "SW";
					break;
				case "247.5":
					direction = "WSW";
					break;
				case "270":
					direction = "W";
					break;
				case "392.5":
					direction = "WNW";
					break;
				case "315":
					direction = "NW";
					break;
				case "337.5":
					direction = "NNW";
					break;
				default:
					direction = feature.properties.moving_dir;
					break;
			}
		}

		const activeAtDate = new Date(feature.properties.active_at);
		const expireAtDate = new Date(feature.properties.expire_at);
		const activeAt = `${activeAtDate.getUTCDate().toString().padStart(2, "0")}/${activeAtDate.getUTCHours().toString().padStart(2, "0")}${activeAtDate.getUTCMinutes().toString().padStart(2, "0")}`;
		const expireAt = `${expireAtDate.getUTCDate().toString().padStart(2, "0")}/${expireAtDate.getUTCHours().toString().padStart(2, "0")}${expireAtDate.getUTCMinutes().toString().padStart(2, "0")}`;
		const movingSpeed = feature.properties.moving_speed || "&mdash;";
		const lowerLevel = feature.properties.lower_level ?? "SFC";
		const upperLevel = feature.properties.upper_level ?? "FL600";
		const severity =
			!feature.properties.intensity || !feature.properties.intensity_code
				? null
				: `${feature.properties.intensity} - ${feature.properties.intensity_code}`;
		const coverage = !feature.properties.coverage ? null : feature.properties.coverage;

		const popupText = `<div><strong>${configuration.properties.label} ${HAZARD_TEXT[feature.properties.phenomenon]}</strong>
		${severity ? `<ul><li><field>Severity</field> <value>${severity}</value></li></ul>` : ""}
		${coverage ? `<ul><li><field>Coverage</field> <value>${coverage}</value></li></ul>` : ""}
		<ul><li><field>Valid</field> <value>${activeAt}-${expireAt}z</value></li>
		<li><field>Altitude</field> <value>${lowerLevel}-${upperLevel}</value></li>
		<li><field>Movement</field> <value>${movingSpeed === "&mdash;" ? movingSpeed : direction + " at " + movingSpeed + "KTS"}</value></li></ul></div>`;

		const id = feature.properties.sigmet_id || feature.properties.fpg_id;

		const detailsText = `
			<p class="section-1">${configuration.properties.label} ${HAZARD_TEXT[feature.properties.phenomenon]} ${id}</p>
			<ul class="section-2">
				${severity ? `<li><span>Severity</span> <span>${severity}</span></li>` : ""}
				${coverage ? `<li><span>Coverage</span> <span>${coverage}</span></li>` : ""}
				<li><span>ID</span> <span>${id}</span></li>
				<li><span>Valid</span> <span>${activeAt}-${expireAt}z</span></li>
				<li><span>Altitude</span> <span>${lowerLevel}-${upperLevel}</span></li>						
			</ul>
			<p class="section-3">${feature.properties.data}</p>
		`;

		const truncatedPopupText = `<div><strong>${configuration.properties.label} ${HAZARD_TEXT[feature.properties.phenomenon]}</strong></div>`;

		const computed = {
			popupText,
			truncatedPopupText,
			detailsText,
			label: `${configuration.properties.label} ${HAZARD_TEXT[feature.properties.phenomenon]} ${id}`,
			type: "weather",
		};

		feature["computed"] = computed;
	}
	function filterMinimumFlightLevel(
		featureSet: Set<Feature>,
		minimumFlightLevelParameterValue,
		maximumFlightLevelParameterValue,
		currentTime
	) {
		// include features if there's any overlap between the feature and altitude slider range
		if (!minimumFlightLevelParameterValue && !maximumFlightLevelParameterValue) {
			return featureSet;
		}

		const minFL = Number(minimumFlightLevelParameterValue);
		const maxFL = Number(maximumFlightLevelParameterValue);
		const features = Array.from(featureSet);
		return features.filter(function (feature) {
			const featureCeilingFL = returnNumericFlightLevel(
				feature.properties.upper_level
			);
			const featureFloorFL = returnNumericFlightLevel(feature.properties.lower_level);
			const featureValidStart = new Date(feature.properties.active_at);
			const featureValidEnd = new Date(feature.properties.expire_at);
			// If lacking an altitude value will be displayed

			var altitudeOverlap =
				!(featureCeilingFL >= 0 && featureFloorFL >= 0) ||
				(featureFloorFL <= maxFL && featureCeilingFL >= minFL);
			const timeOverlap = currentTime >= featureValidStart && currentTime <= featureValidEnd;

			return altitudeOverlap && timeOverlap;
		});
	}
	function returnNumericFlightLevel(flightLevel) {
		if (!flightLevel) return;
		const regex = /FL|SFC/gi;
		var flightLevelNumber = flightLevel.replace(regex, "");
		return Number(flightLevelNumber);
	}

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		if (
			feature.geometry instanceof pangea.geography.GeoPolygon ||
			feature.geometry instanceof pangea.geography.MultiGeoPolygon
		) {
			if (!feature["computed"]) {
				compute(feature);
			}

			const overlays = [];

			const { issuing_station, intensity_code, phenomenon, coverage } = { ...feature.properties };
			const isWSI = issuing_station === WSI_ISSUED;

			// setup defaults
			let strokeColor = "#ffffff";
			let fillColor = "#ffffff";
			let fillOpacity = 0.4;
			let strokeWidth = 2;

			const outlineStyleSolid = [1];
			const outlineStyleDashed = [3, 1];
			let outlineStyle = outlineStyleSolid;

			if (intensity_code <= 3) strokeWidth = 1;
			else if (intensity_code === 4) strokeWidth = 2;
			else if (intensity_code > 4) strokeWidth = 4;

			if (isWSI) fillOpacity = 0.0;
			else fillOpacity = 0.4;

			const halfCoverage = ["SCT", "SCT-BKN"];
			const fullCoverage = ["BKN", "SOLID"];

			switch (phenomenon) {
				case "DUST":
					strokeColor = "#cfb275";
					fillColor = "#cfb275";
					break;
				case "CONV":
					strokeColor = "#ff4444";
					fillColor = "#ff4444";
					if (halfCoverage.includes(coverage)) outlineStyle = outlineStyleDashed;
					if (!isWSI) {
						strokeColor = "#ffffff";
						fillColor = "#ffffff";
					}
					break;
				case "TURB":
					strokeColor = "#00ff00";
					fillColor = "#00ff00";
					if (intensity_code < 4) outlineStyle = outlineStyleDashed;
					break;
				case "ICING":
					strokeColor = "#0000ff";
					fillColor = "#0000ff";
					if (intensity_code < 4) outlineStyle = outlineStyleDashed;
					break;
				case "VA":
					strokeWidth = 4;
					if (isWSI) {
						strokeColor = "#ff832b";
						fillColor = "#ff832b";
					} else {
						strokeColor = "#ff0000";
						fillColor = "#ff0000";
					}
					break;
				case "VIS":
					strokeColor = "#b799d0";
					fillColor = "#b799d0";
					break;
				case "WINDS":
					strokeColor = "#93bed5";
					fillColor = "#93bed5";
					break;
				case "SAND":
					strokeColor = "#f8f299";
					fillColor = "#f8f299";
					break;
				case "SPEC":
					strokeWidth = 4;
					strokeColor = "#A56EFF";
					fillColor = "#A56EFF";
					break;
			}

			const hazardOutlineStyle = {
				color: strokeColor,
				opacity: 1,
				width: strokeWidth,
				dashArray: outlineStyle,
			};

			const hazardStyle = {
				fill: {
					color: fillColor,
					opacity: fillOpacity,
				},
				stroke: {
					color: strokeColor,
					opacity: 0,
					width: strokeWidth,
				},
			};

			const sortIndex = _sigmetSortIndex(phenomenon, intensity_code);
			if (feature instanceof pangea.data.PolygonFeature) {
				overlays.push(new pangea.overlays.PolygonPath(feature.geometry, hazardStyle, { sortIndex }));
				overlays.push(
					new pangea.overlays.LinePath(feature.geometry.lines[0], hazardOutlineStyle)
				);
			} else if (feature instanceof pangea.data.MultiPolygonFeature) {
				overlays.push(new pangea.overlays.MultiPolygonPath(feature.geometry, hazardStyle, { sortIndex }));
				const lines = feature.geometry.polygons.map((polygon) => polygon.lines[0]);
				overlays.push(new pangea.overlays.MultiLinePath(lines, hazardOutlineStyle));
			}
			return overlays;
		}

		return [];
	});

	// Filter
	let filter = configuration.layerOptions?.filterFeatures ?? ((features: Set<Feature>) => {
		const result: Set<Feature> = new Set();

		const filteredFeatures = filterMinimumFlightLevel(
			features,
			configuration.properties.rangeMinimum,
			configuration.properties.rangeMaximum,
			new Date(configuration.properties.time).valueOf()
		);

		for (const feature of filteredFeatures) {
			if (!feature["computed"]) {
				compute(feature);
			}

			const phenomenon = feature.properties.phenomenon;
			if (
				(configuration.properties.showConvective && phenomenon === "CONV") ||
				(configuration.properties.showDust && phenomenon === "DUST") ||
				(configuration.properties.showIcing && phenomenon === "ICING") ||
				(configuration.properties.showSand && phenomenon === "SAND") ||
				(configuration.properties.showSurfaceWind && phenomenon === "WINDS") ||
				(configuration.properties.showTurbulence && phenomenon === "TURB") ||
				(configuration.properties.showVisibility && phenomenon === "VIS") ||
				(configuration.properties.showVolcanicAsh && phenomenon === "VA")
			) {
				result.add(feature);
				continue;
			}
		}
		return result;
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		filterFeatures: filter,
		id: productKey + "-sigmets-government-feature-layer",
		meta: { temporalStatus: "observation" },
		slot: 0,
		styleFeature: style,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;

}

//#endregion

//#region AIRMETs

export function AirmetsGovernmentObservedFeature(configuration: SunFeatureConfiguration<AirmetGovernmentProperties> = {}): SunFeaturePreset<AirmetGovernmentProperties> {
	configuration = { ...configuration, properties: configuration.properties ?? {} as AirmetGovernmentProperties };

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Properties
	let defaultProperties: AirmetGovernmentProperties = {
		showConvective:  true,
		showDust:        true,
		showIcing:       true,
		showSand:        true,
		showSurfaceWind: true,
		showTurbulence:  true,
		showVisibility:  true,
		showVolcanicAsh: true,
	};
	let properties = { ...defaultProperties, ...configuration.properties };

	// Product
	let productKey = configuration.productKey ?? "6002";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-airmets-government-observed-feature-source",
		validity: { backward: 8640000000000000, forward: 8640000000000000 }
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		let fillColor: any = [0, 255, 0, 1];
		switch (feature.properties.phenomenon) {
			case "SAND":
			case "CONV":
			case "VA":
			case "VIS":
			case "IFR":
			case "DUST":
				fillColor = pangea.visuals.Color.RED;
				break;
			case "WIND":
			case "WINDS":
				fillColor = pangea.visuals.Color.WHITE;
				break;
			case "TURB":
				fillColor = pangea.visuals.Color.YELLOW;
				break;
			case "ICING":
				fillColor = pangea.visuals.Color.CYAN;
				break;
		}

		const shapeStyle: any = {
			fill: { color: fillColor, opacity: 0.4 },
			stroke: { color: [128, 128, 128, 1], opacity: 1, width: 1 }
		};

		const sortIndex = _sigmetSortIndex(feature.properties.phenomenon);
		if (feature instanceof pangea.data.PolygonFeature) {
			return [new pangea.overlays.PolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		} else if (feature instanceof pangea.data.MultiPolygonFeature) {
			return [new pangea.overlays.MultiPolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		}
		return [];
	});

	// Filter
	let filterFeatures = configuration.layerOptions?.filterFeatures ?? ((features: Set<Feature>) => {
		const result: Set<Feature> = new Set();
		for (const feature of features) {
			const ph = feature.properties.phenomenon;
			if (
				(properties.showConvective  !== false && ph === "CONV")  ||
				(properties.showDust        !== false && ph === "DUST")  ||
				(properties.showIcing       !== false && ph === "ICING") ||
				(properties.showSand        !== false && ph === "SAND")  ||
				(properties.showSurfaceWind !== false && (ph === "WIND" || ph === "WINDS")) ||
				(properties.showTurbulence  !== false && ph === "TURB")  ||
				(properties.showVisibility  !== false && (ph === "VIS" || ph === "IFR")) ||
				(properties.showVolcanicAsh !== false && ph === "VA")
			) {
				result.add(feature);
			}
		}
		return result;
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		id: productKey + "-airmets-government-observed-feature-layer",
		styleFeature: style,
		filterFeatures: filterFeatures,
		meta: { temporalStatus: "observation" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	configuration.properties = properties;
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region Temporary Flight Restrictions

export function TemporaryFlightRestrictionObservedFeature(configuration: SunFeatureConfiguration<TfrProperties> = {}): SunFeaturePreset<TfrProperties> {
	configuration = { ...configuration, properties: configuration.properties ?? {} as TfrProperties };

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6001";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-temporary-flight-restriction-observed-feature-source"
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Filter
	let filter = configuration.layerOptions?.filterFeatures ?? ((features: Set<Feature>) => {
		const result: Set<Feature> = new Set();
		for (const feature of features) {
			const cls = feature.properties.classification;
			if (cls === 'PRESIDENTIAL') {
				if (configuration.properties.showPresidential !== false) result.add(feature);
			} else if (cls === 'FIRE/SPRAYING/RESCUE') {
				if (configuration.properties.showFire !== false) result.add(feature);
			} else if (configuration.properties.showOther !== false) {
				result.add(feature);
			}
		}
		return result;
	});

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		const shapeStyle: any = {
			fill: { color: [255, 255, 255, 0.2], opacity: 1 },
			stroke: { color: [250, 77, 86, 1], opacity: 1, width: 1.5 }
		};

		const sortIndex = _tfrSortIndex(feature.properties.classification);
		if (feature instanceof pangea.data.PolygonFeature) {
			return [new pangea.overlays.PolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		} else if (feature instanceof pangea.data.MultiPolygonFeature) {
			return [new pangea.overlays.MultiPolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		}
		return [];
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		filterFeatures: filter,
		id: productKey + "-temporary-flight-restriction-observed-feature-layer",
		styleFeature: style,
		meta: { temporalStatus: "observation" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region Flight Information Regions

export function FlightInformationRegionsFeature(configuration: SunFeatureConfiguration = {}): SunFeaturePreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6024";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-flight-information-regions-feature-source"
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		const shapeStyle: any = {
			fill: { color: [0, 0, 0, 0], opacity: 0 },
			stroke: { color: [132, 147, 147, 1], opacity: 1, width: 1.5 }
		};

		if (feature instanceof pangea.data.PolygonFeature) {
			return [new pangea.overlays.PolygonPath(feature.geometry, shapeStyle)];
		} else if (feature instanceof pangea.data.MultiPolygonFeature) {
			return [new pangea.overlays.MultiPolygonPath(feature.geometry, shapeStyle)];
		}
		return [];
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		id: productKey + "-flight-information-regions-feature-layer",
		styleFeature: style,
		meta: { temporalStatus: "static" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region FPGs

export function FpgsObservedFeature(configuration: SunFeatureConfiguration = {}): SunFeaturePreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6007";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-fpgs-observed-feature-source",
		validity: { backward: 8640000000000000, forward: 8640000000000000 }
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style — uses the same polygon style as SIGMETs TWC
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		let dashArray: number[] | undefined;
		let strokeWidth = 2;
		let strokeColor: any = [165, 110, 255, 1];

		switch (feature.properties.phenomenon) {
			case "CONV":
				strokeColor = [250, 77, 86, 1];
				if (feature.properties.intensity_code < 4) { strokeWidth = 1; dashArray = [8, 2]; }
				else if (feature.properties.intensity_code === 4) { strokeWidth = 2; }
				else if (feature.properties.intensity_code > 4) { strokeWidth = 4; }
				break;
			case "TURB":
				strokeColor = [36, 161, 72, 1];
				if (feature.properties.intensity_code < 4) { strokeWidth = 1; dashArray = [8, 2]; }
				else if (feature.properties.intensity_code === 4) { strokeWidth = 2; }
				else if (feature.properties.intensity_code > 4) { strokeWidth = 4; }
				break;
			case "ICNG":
				strokeColor = [69, 137, 255, 1];
				if (feature.properties.intensity_code < 4) { strokeWidth = 1; dashArray = [8, 2]; }
				else if (feature.properties.intensity_code === 4) { strokeWidth = 2; }
				else if (feature.properties.intensity_code > 4) { strokeWidth = 4; }
				break;
			case "VASH":
				strokeColor = [255, 131, 43, 1];
				strokeWidth = 2;
				break;
		}

		const shapeStyle: any = {
			fill: { color: [0, 0, 0, 0] },
			stroke: { color: strokeColor, dashArray, opacity: 1, width: strokeWidth }
		};

		const sortIndex = _sigmetSortIndex(feature.properties.phenomenon, feature.properties.intensity_code);
		if (feature instanceof pangea.data.PolygonFeature) {
			return [new pangea.overlays.PolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		} else if (feature instanceof pangea.data.MultiPolygonFeature) {
			return [new pangea.overlays.MultiPolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		}
		return [];
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		id: productKey + "-fpgs-observed-feature-layer",
		styleFeature: style,
		meta: { temporalStatus: "observation" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region IATA EDR

const IATA_EDR_BARB_CUTOFFS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 120, 125, 130, 135, 140, 145, 150];
const IATA_KNOTS_PER_MS = 1.94384;

export type IataEdrProperties = {
	showSeverity?:    boolean;
	showAltitude?:    boolean;
	showTemperature?: boolean;
	showWindBarbs?:   boolean;
}

export function IataEdrObservedFeature(configuration: SunFeatureConfiguration<IataEdrProperties> = {}): SunFeaturePreset<IataEdrProperties> {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Properties
	let defaultProperties: IataEdrProperties = {
		showSeverity:    true,
		showAltitude:    true,
		showTemperature: true,
		showWindBarbs:   true,
	};
	let properties = { ...defaultProperties, ...configuration.properties };

	// Product
	let productKey = configuration.productKey ?? "6021";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-iata-edr-observed-feature-source"
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		if (!(feature instanceof pangea.data.PointFeature)) return [];

		const overlays = [];

		// Severity icon
		let severity: string;
		if (feature.properties.edr_peak < 0.15) { severity = "nil"; }
		else if (feature.properties.edr_peak < 0.20) { severity = "light"; }
		else if (feature.properties.edr_peak < 0.44) { severity = "medium"; }
		else { severity = "severe"; }

		if (properties.showSeverity !== false) {
			overlays.push(new pangea.overlays.ImageMarker(feature.geometry, {
				scale: 1,
				source: (Settings.assetPath ?? "") + "/images/iata-edr/" + severity + ".png"
			}));
		}

		// Temperature label (right side)
		if (properties.showTemperature && feature.properties.temperature) {
			overlays.push(new pangea.overlays.TextMarker(feature.properties.temperature, feature.geometry, {
				color: [198, 198, 198, 1],
				anchor: pangea.visuals.Anchor.LEFT,
				offset: [12, 0],
				size: 12,
				font: { family: "Source Code Pro" },
				stroke: { color: pangea.visuals.Color.BLACK, width: 0.5 }
			}));
		}

		// Flight level label (left side)
		if (properties.showAltitude && feature.properties.flight_level) {
			overlays.push(new pangea.overlays.TextMarker(feature.properties.flight_level, feature.geometry, {
				color: [198, 198, 198, 1],
				anchor: pangea.visuals.Anchor.RIGHT,
				offset: [-12, 0],
				size: 12,
				font: { family: "Source Code Pro" },
				stroke: { color: pangea.visuals.Color.BLACK, width: 0.5 }
			}));
		}

		// Wind barb
		if (properties.showWindBarbs && feature.properties.wind_speed && feature.properties.wind_direction) {
			const velocity = feature.properties.wind_speed / 1.15078;
			let barbSrc = "";
			for (let i = 0; i < IATA_EDR_BARB_CUTOFFS.length - 1; i++) {
				const min = IATA_EDR_BARB_CUTOFFS[i] / IATA_KNOTS_PER_MS;
				const max = IATA_EDR_BARB_CUTOFFS[i + 1] / IATA_KNOTS_PER_MS;
				if (velocity >= min && velocity <= max) {
					barbSrc = (Settings.assetPath ?? "") + "/images/wind-barbs/Knots=" + IATA_EDR_BARB_CUTOFFS[i] + ".png";
					break;
				}
			}
			if (barbSrc) {
				overlays.push(new pangea.overlays.ImageMarker(feature.geometry, {
					anchor: pangea.visuals.Anchor.BOTTOM,
					source: barbSrc,
					scale: 1,
					rotation: feature.properties.wind_direction
				}));
			}
		}

		return overlays;
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		id: productKey + "-iata-edr-observed-feature-layer",
		imageOverlapEnabled: true,
		textOverlapEnabled: true,
		styleFeature: style,
		meta: { temporalStatus: "observation" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	configuration.properties = properties;
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region Oceanic Tracks

export function OceanicTracksObservedFeature(configuration: SunFeatureConfiguration = {}): SunFeaturePreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6004";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-oceanic-tracks-observed-feature-source",
		validity: { backward: 8640000000000000, forward: 8640000000000000 }
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		const result = [];
		const lineStyle: any = { color: [139, 65, 134, 1], width: 2 };
		const textStyle: any = {
			color: [244, 244, 244, 1],
			anchor: pangea.visuals.Anchor.CENTER,
			size: 12,
			font: { family: "Source Code Pro" },
			stroke: { color: pangea.visuals.Color.BLACK, width: 0.5 }
		};

		if (feature.geometry instanceof pangea.geography.GeoLine) {
			result.push(new pangea.overlays.LinePath(feature.geometry, lineStyle));
			const midPoint = feature.geometry.points[Math.floor(feature.geometry.points.length / 2)];
			result.push(new pangea.overlays.TextMarker(feature.properties.trackId ?? "", midPoint, textStyle));
		} else if (feature.geometry instanceof pangea.geography.MultiGeoLine) {
			result.push(new pangea.overlays.MultiLinePath(feature.geometry, lineStyle));
			for (const line of feature.geometry.lines) {
				const midPoint = line.points[Math.floor(line.points.length / 2)];
				result.push(new pangea.overlays.TextMarker(feature.properties.trackId ?? "", midPoint, textStyle));
			}
		}
		return result;
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		id: productKey + "-oceanic-tracks-observed-feature-layer",
		styleFeature: style,
		meta: { temporalStatus: "observation" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region Restricted Airspaces

export type RestrictedAirspacesProperties = {
	showAlert?:       boolean;
	showATCAA?:       boolean;
	showCaution?:     boolean;
	showDanger?:      boolean;
	showMilitaryOps?: boolean;
	showProhibited?:  boolean;
	showRestricted?:  boolean;
	showWarning?:     boolean;
}

export function RestrictedAirspacesObservedFeature(configuration: SunFeatureConfiguration<RestrictedAirspacesProperties> = {}): SunFeaturePreset<RestrictedAirspacesProperties> {
	configuration = { ...configuration, properties: configuration.properties ?? {} as RestrictedAirspacesProperties };

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6027";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-restricted-airspaces-observed-feature-source"
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		let fillColor: any;
		switch (feature.properties.status) {
			case "H": fillColor = [18, 30, 40, 0.25]; break;    // Active
			case "W": fillColor = [255, 131, 43, 0.25]; break;  // Waiting to Start
			case "P": fillColor = [241, 194, 27, 0.25]; break;  // Pending Approval
			default:  fillColor = [255, 255, 255, 0.20]; break; // Not Scheduled
		}

		const shapeStyle: any = {
			fill: { color: fillColor, opacity: 1 },
			stroke: { color: [0, 0, 0, 1], opacity: 1, width: 1 }
		};

		const sortIndex = _restrictedAirspaceSortIndex(feature.properties.status, feature.properties.restriction_type);
		if (feature instanceof pangea.data.PolygonFeature) {
			return [new pangea.overlays.PolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		} else if (feature instanceof pangea.data.MultiPolygonFeature) {
			return [new pangea.overlays.MultiPolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		}
		return [];
	});

	// Filter
	let filter = configuration.layerOptions?.filterFeatures ?? ((features: Set<Feature>) => {
		const result: Set<Feature> = new Set();
		for (const feature of features) {
			const t = feature.properties.restriction_type;
			if (
				(configuration.properties.showAlert       && t === 'L') ||
				(configuration.properties.showATCAA       && t === 'A') ||
				(configuration.properties.showCaution     && t === 'C') ||
				(configuration.properties.showDanger      && t === 'D') ||
				(configuration.properties.showMilitaryOps && t === 'M') ||
				(configuration.properties.showProhibited  && t === 'P') ||
				(configuration.properties.showRestricted  && t === 'R') ||
				(configuration.properties.showWarning     && t === 'W')
			) {
				result.add(feature);
			}
		}
		return result;
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		filterFeatures: filter,
		id: productKey + "-restricted-airspaces-observed-feature-layer",
		styleFeature: style,
		meta: { temporalStatus: "observation" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region SIGMETs TWC

export function SigmetsTwcObservedFeature(configuration: SunFeatureConfiguration<SigmetsTwcProperties> = {}): SunFeaturePreset<SigmetsTwcProperties> {
	configuration = { ...configuration, properties: configuration.properties ?? {} as SigmetsTwcProperties };

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6006";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-sigmets-twc-observed-feature-source"
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Filter
	let filter = configuration.layerOptions?.filterFeatures ?? ((features: Set<Feature>) => {
		const result: Set<Feature> = new Set();
		for (const feature of features) {
			const p = feature.properties.phenomenon;
			if (
				(configuration.properties.showConvective  !== false && p === 'CONV') ||
				(configuration.properties.showDust        !== false && p === 'BLDU') ||
				(configuration.properties.showIcing       !== false && p === 'ICNG') ||
				(configuration.properties.showSpecial     !== false && p === 'OZNE') ||
				(configuration.properties.showTurbulence  !== false && p === 'TURB') ||
				(configuration.properties.showVisibility  !== false && p === 'VIS')  ||
				(configuration.properties.showVolcanicAsh !== false && p === 'VASH')
			) {
				result.add(feature);
			}
		}
		return result;
	});

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		let dashArray: number[] | undefined;
		let strokeWidth = 2;
		let strokeColor: any = [165, 110, 255, 1];

		switch (feature.properties.phenomenon) {
			case "CONV":
				strokeColor = [250, 77, 86, 1];
				if (feature.properties.intensity_code < 4) { strokeWidth = 1; dashArray = [8, 2]; }
				else if (feature.properties.intensity_code === 4) { strokeWidth = 2; }
				else if (feature.properties.intensity_code > 4) { strokeWidth = 4; }
				break;
			case "OZNE":
				strokeColor = [255, 126, 182, 1];
				dashArray = [8, 2];
				strokeWidth = 1;
				break;
			case "TURB":
				strokeColor = [36, 161, 72, 1];
				if (feature.properties.intensity_code < 4) { strokeWidth = 1; dashArray = [8, 2]; }
				else if (feature.properties.intensity_code === 4) { strokeWidth = 2; }
				else if (feature.properties.intensity_code > 4) { strokeWidth = 4; }
				break;
			case "ICNG":
				strokeColor = [69, 137, 255, 1];
				if (feature.properties.intensity_code < 4) { strokeWidth = 1; dashArray = [8, 2]; }
				else if (feature.properties.intensity_code === 4) { strokeWidth = 2; }
				else if (feature.properties.intensity_code > 4) { strokeWidth = 4; }
				break;
			case "VASH":
				strokeColor = [255, 131, 43, 1];
				strokeWidth = 2;
				break;
			case "BLDU":
				strokeColor = [255, 131, 43, 1];
				strokeWidth = 1;
				break;
			default:
				if (feature.properties.intensity_code < 4) { strokeWidth = 1; dashArray = [8, 2]; }
				else if (feature.properties.intensity_code === 4) { strokeWidth = 2; }
				else if (feature.properties.intensity_code > 4) { strokeWidth = 4; }
				break;
		}

		const shapeStyle: any = {
			fill: { color: [0, 0, 0, 0] },
			stroke: { color: strokeColor, dashArray, opacity: 1, width: strokeWidth }
		};

		const sortIndex = _sigmetSortIndex(feature.properties.phenomenon, feature.properties.intensity_code);
		if (feature instanceof pangea.data.PolygonFeature) {
			return [new pangea.overlays.PolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		} else if (feature instanceof pangea.data.MultiPolygonFeature) {
			return [new pangea.overlays.MultiPolygonPath(feature.geometry, shapeStyle, { sortIndex })];
		}
		return [];
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		filterFeatures: filter,
		id: productKey + "-sigmets-twc-observed-feature-layer",
		styleFeature: style,
		meta: { temporalStatus: "observation" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region Significant Weather

export function SignificantWeatherObservedFeature(configuration: SunFeatureConfiguration<SignificantWeatherProperties> = {}): SunFeaturePreset<SignificantWeatherProperties> {
	configuration = { ...configuration, properties: configuration.properties ?? {} as SignificantWeatherProperties };

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "1262";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-significant-weather-observed-feature-source"
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		const assetBase = Settings.assetPath ?? "";
		const overlays = [];

		switch (feature.properties.layer_name) {

			case "CONVECTION": {
				let fillPattern: string;
				let strokeColor: any;
				let strokeWidth: number;
				switch (feature.properties.layer_properties?.convection_type) {
					case "ISOL":
					case "ISOL/EMBED":
						fillPattern = assetBase + "/images/significant-weather/cb-area-pattern-isolated.png";
						strokeColor = [241, 194, 27, 0.3];
						strokeWidth = 1;
						break;
					case "OCNL":
					case "OCNL/EMBED":
						fillPattern = assetBase + "/images/significant-weather/cb-area-pattern-occasional.png";
						strokeColor = [190, 149, 255, 0.3];
						strokeWidth = 1;
						break;
					default: // FREQUENT
						fillPattern = assetBase + "/images/significant-weather/cb-area-pattern-frequent.png";
						strokeColor = [250, 77, 86, 0.3];
						strokeWidth = 1;
						break;
				}
				const shapeStyle: any = {
					fill: { opacity: 1, pattern: fillPattern },
					stroke: { color: strokeColor, width: strokeWidth }
				};
				const sortIndex = _sigwxSortIndex('CONVECTION', feature.properties.layer_properties?.convection_type);
				if (feature instanceof pangea.data.PolygonFeature) {
					overlays.push(new pangea.overlays.PolygonPath(feature.geometry, shapeStyle, { sortIndex }));
				} else if (feature instanceof pangea.data.MultiPolygonFeature) {
					overlays.push(new pangea.overlays.MultiPolygonPath(feature.geometry, shapeStyle, { sortIndex }));
				}
				break;
			}

			case "JET_STREAM": {
				const lineStyle: any = { color: [91, 91, 91, 1], width: 18, opacity: 1 };
				if (feature instanceof pangea.data.LineFeature) {
					overlays.push(new pangea.overlays.LinePath(feature.geometry, lineStyle));
					const pts = feature.geometry.points;
					const bearing = pts[pts.length - 2].calculateBearing(pts[pts.length - 1]);
					overlays.push(new pangea.overlays.ImageMarker(pts[pts.length - 1], {
						source: assetBase + "/images/significant-weather/jet-stream-arrowhead.png",
						rotation: bearing - 90, offset: [16, 0], scale: 0.5, opacity: 1
					}));
				} else if (feature instanceof pangea.data.MultiLineFeature) {
					overlays.push(new pangea.overlays.MultiLinePath(feature.geometry, lineStyle));
					const line = feature.geometry.lines[0];
					const pts = line.points;
					const bearing = pts[pts.length - 2].calculateBearing(pts[pts.length - 1]);
					overlays.push(new pangea.overlays.ImageMarker(pts[pts.length - 1], {
						source: assetBase + "/images/significant-weather/jet-stream-arrowhead.png",
						rotation: bearing - 90, offset: [22, 0], scale: 0.5, opacity: 1
					}));
				}
				break;
			}

			case "JET_STREAM_POINT_DATA": {
				if (feature instanceof pangea.data.PointFeature) {
					const text = feature.properties.layer_properties?.jet_wind_speed + "K\n" +
						"FL" + feature.properties.layer_properties?.jet_wind_level;
					overlays.push(new pangea.overlays.TextMarker(text, feature.geometry, {
						alignment: pangea.visuals.Alignment.LEFT,
						background: { scale: 0.55, source: assetBase + "/images/significant-weather/jet-stream-tag.png" },
						color: [255, 255, 255, 1],
						font: { family: "Source Code Pro" },
						size: 12
					}));
				}
				break;
			}

			case "HURRICANE": {
				if (feature instanceof pangea.data.PointFeature) {
					const src = feature.geometry.latitude > 0
						? assetBase + "/images/significant-weather/hurricane-north-dark.png"
						: assetBase + "/images/significant-weather/hurricane-south-dark.png";
					overlays.push(new pangea.overlays.ImageMarker(feature.geometry, { scale: 0.5, source: src }));
				}
				break;
			}

			case "TROPICAL":
			case "STORM": {
				if (feature instanceof pangea.data.PointFeature) {
					const src = feature.geometry.latitude > 0
						? assetBase + "/images/significant-weather/tropical-storm-north-dark.png"
						: assetBase + "/images/significant-weather/tropical-storm-south-dark.png";
					overlays.push(new pangea.overlays.ImageMarker(feature.geometry, { scale: 0.5, source: src }));
				}
				break;
			}

			case "TROPOPAUSE": {
				if (feature instanceof pangea.data.PointFeature) {
					const tropType = feature.properties.layer_properties?.trop_type;
					const tropHeight = feature.properties.layer_properties?.trop_height;
					let text: string;
					let bgRotation = 0;
					let offset: [number, number] = [0, 0];
					if (tropType === "LOW") {
						text = tropHeight + "\nL";
						offset = [0, -2];
					} else if (tropType === "HIGH") {
						text = "H\n" + tropHeight;
						bgRotation = 180;
						offset = [0, 2];
					} else {
						text = tropHeight;
					}
					const bgSrc = tropType === "SPOT"
						? assetBase + "/images/significant-weather/tropopause-backplate-spot-dark.png"
						: assetBase + "/images/significant-weather/tropopause-backplate-dark.png";
					overlays.push(new pangea.overlays.TextMarker(text, feature.geometry, {
						anchor: pangea.visuals.Anchor.CENTER,
						background: { source: bgSrc, scale: 0.6, rotation: bgRotation },
						color: [255, 255, 255, 1],
						font: { family: "Source Code Pro" },
						offset, size: 12
					}));
				}
				break;
			}

			case "TURBULENCE": {
				const turbStyle: any = {
					fill: { color: [0, 0, 0, 0], opacity: 0 },
					stroke: { color: [241, 194, 27, 1], dashArray: [2, 2], width: 2 }
				};
				const turbSortIndex = _sigwxSortIndex('TURBULENCE');
				if (feature instanceof pangea.data.PolygonFeature) {
					overlays.push(new pangea.overlays.PolygonPath(feature.geometry, turbStyle, { sortIndex: turbSortIndex }));
				} else if (feature instanceof pangea.data.MultiPolygonFeature) {
					overlays.push(new pangea.overlays.MultiPolygonPath(feature.geometry, turbStyle, { sortIndex: turbSortIndex }));
				}
				break;
			}

			case "TURBULENCE_POINT_DATA": {
				if (feature instanceof pangea.data.PointFeature) {
					const text = feature.properties.layer_properties?.turb_base_level + "\n" +
						feature.properties.layer_properties?.turb_upper_level;
					overlays.push(new pangea.overlays.TextMarker(text, feature.geometry, {
						alignment: pangea.visuals.Alignment.LEFT,
						color: [210, 161, 6, 1],
						font: { family: "Source Code Pro" },
						offset: [0, 8], size: 12
					}));
					overlays.push(new pangea.overlays.ImageMarker(feature.geometry, {
						offset: [0, -25], scale: 0.5,
						source: assetBase + "/images/significant-weather/turbulence-moderate-dark.png"
					}));
				}
				break;
			}

			case "VOLCANO": {
				if (feature instanceof pangea.data.PointFeature) {
					overlays.push(new pangea.overlays.ImageMarker(feature.geometry, {
						scale: 0.5,
						source: assetBase + "/images/significant-weather/volcano-dark.png"
					}));
				}
				break;
			}
		}

		return overlays;
	});

	// Filter
	let filter = configuration.layerOptions?.filterFeatures ?? ((features: Set<Feature>) => {
		const result: Set<Feature> = new Set();
		for (const feature of features) {
			const name = feature.properties.layer_name;
			if (
				(configuration.properties.showCBAreas    !== false && name === 'CONVECTION') ||
				(configuration.properties.showJetStream  !== false && (name === 'JET_STREAM' || name === 'JET_STREAM_POINT_DATA')) ||
				(configuration.properties.showTropical   !== false && (name === 'STORM' || name === 'HURRICANE' || name === 'TROPICAL')) ||
				(configuration.properties.showTropopause !== false && name === 'TROPOPAUSE') ||
				(configuration.properties.showTurbulence !== false && (name === 'TURBULENCE' || name === 'TURBULENCE_POINT_DATA')) ||
				(configuration.properties.showVolcanoes  !== false && name === 'VOLCANO')
			) {
				result.add(feature);
			}
		}
		return result;
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		filterFeatures: filter,
		id: productKey + "-significant-weather-observed-feature-layer",
		styleFeature: style,
		meta: { temporalStatus: "observation" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region VAAC

export function VaacAdvisoriesObservedFeature(configuration: SunFeatureConfiguration = {}): SunFeaturePreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6015";

	// Source — wide validity window; VAAC advisories can span days
	let defaultSourceOptions: SunFeatureSourceOptions = {
		declutterEnabled: true,
		id: productKey + "-vaac-advisories-observed-feature-source",
		keyZoomLevels: [0, 1, 2, 3, 4, 5, 6],
		slideSequence: true,
		validity: { backward: 3000000000, forward: 3600000000 },
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style — VAAC advisory icon (point feature)
	let style = configuration.layerOptions?.styleFeature ?? ((feature: any) => {
		if (!(feature instanceof pangea.data.PointFeature)) return [];
		return [new pangea.overlays.ImageMarker(feature.geometry, {
			source: (Settings.assetPath ?? "") + "/images/vaac/vaac-advisory.png",
			scale: 0.5,
		})];
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		blendingEnabled:       true,
		dedupingEnabled:       true,
		id:                    productKey + "-feature-layer",
		imageCollisionPadding: 4,
		imageOverlapEnabled:   true,
		meta:                  { temporalStatus: "observation" },
		slot:                  1,
		styleFeature:          style,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

export function VaacCloudPolygonsObservedFeature(configuration: SunFeatureConfiguration = {}): SunFeaturePreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6016";

	// Source — wide validity window matching advisory product
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-vaac-cloud-polygons-observed-feature-source",
		slideSequence: true,
		validity: { backward: 3000000000, forward: 3600000000 },
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style — ash cloud polygon: gray outline + semi-transparent fill
	let style = configuration.layerOptions?.styleFeature ?? ((feature: any) => {
		const overlays: any[] = [];
		const assetBase    = (Settings.assetPath ?? "");
		const outlineStyle = { color: [188, 188, 188, 1] as [number, number, number, number], width: 2, opacity: 1 };
		const fillStyle    = { fill: { opacity: 1, pattern: assetBase + "/images/vaac/vaac-cloud.png" }, stroke: { color: [188, 188, 188, 1] as [number, number, number, number], width: 0, opacity: 0 } };

		if (feature instanceof pangea.data.PolygonFeature) {
			overlays.push(new pangea.overlays.PolygonPath(feature.geometry, fillStyle));
			overlays.push(new pangea.overlays.LinePath(feature.geometry.lines[0], outlineStyle));
		} else if (feature instanceof pangea.data.MultiPolygonFeature) {
			overlays.push(new pangea.overlays.MultiPolygonPath(feature.geometry, fillStyle));
			const lines = feature.geometry.polygons.map((p: any) => p.lines[0]);
			overlays.push(new pangea.overlays.MultiLinePath(lines, outlineStyle));
		}
		return overlays;
	});

	// Filter — only show clouds currently active (forecast window spans now)
	let filter = configuration.layerOptions?.filterFeatures ?? ((features: Set<any>) => {
		const now = Date.now();
		const result = new Set<any>();
		for (const feature of features) {
			const start = feature.properties?.forecast_start_time ? new Date(feature.properties.forecast_start_time).getTime() : -Infinity;
			const end   = feature.properties?.forecast_end_time   ? new Date(feature.properties.forecast_end_time).getTime()   : Infinity;
			if (start <= now && end >= now) result.add(feature);
		}
		return result;
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		blendingEnabled:  true,
		dedupingEnabled:  true,
		filterFeatures:   filter,
		id:               productKey + "-feature-layer",
		meta:             { temporalStatus: "observation" },
		slot:             1,
		styleFeature:     style,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

//#endregion

//#region Temperature Aloft

export enum TemperatureAloftFlightLevels {
	FL050 = "FL050",
	FL100 = "FL100",
	FL140 = "FL140",
	FL180 = "FL180",
	FL240 = "FL240",
	FL300 = "FL300",
	FL340 = "FL340",
	FL390 = "FL390",
	FL450 = "FL450",
	FL530 = "FL530"
}

const TEMPERATURE_ALOFT_PALETTE = new pangea.visuals.Palette([
	{ value: -80, color: [73, 29, 139, 1] },
	{ value: -70, color: [73, 29, 139, 1] },
	{ value: -60, color: [105, 41, 198, 1] },
	{ value: -50, color: [105, 41, 198, 1] },
	{ value: -40, color: [138, 63, 252, 1] },
	{ value: -30, color: [138, 63, 252, 1] },
	{ value: -20, color: [165, 110, 255, 1] },
	{ value: -10, color: [165, 110, 255, 1] },
	{ value: 0,   color: [190, 149, 255, 1] },
	{ value: 10,  color: [190, 149, 255, 1] },
	{ value: 20,  color: [212, 187, 255, 1] },
	{ value: 30,  color: [212, 187, 255, 1] },
	{ value: 40,  color: [255, 183, 132, 1] },
	{ value: 50,  color: [255, 183, 132, 1] },
	{ value: 60,  color: [255, 131, 43, 1] },
	{ value: 70,  color: [255, 131, 43, 1] },
	{ value: 80,  color: [235, 98, 0, 1] },
	{ value: 90,  color: [235, 98, 0, 1] },
	{ value: 100, color: [250, 77, 86, 1] },
	{ value: 110, color: [250, 77, 86, 1] },
	{ value: 120, color: [218, 30, 40, 1] }
], { id: "Temperature Aloft", minimumColorExtended: true, maximumColorExtended: true, interpolation: "NONE" });

export type TemperatureAloftProperties = {
	flightLevel?: TemperatureAloftFlightLevels;
}

export function TemperatureAloftGfsForecastFeature(configuration: SunFeatureConfiguration<TemperatureAloftProperties> = {}): SunFeaturePreset<TemperatureAloftProperties> {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Properties
	let defaultProperties: TemperatureAloftProperties = {
		flightLevel: TemperatureAloftFlightLevels.FL050
	};
	let properties = { ...defaultProperties, ...configuration.properties };

	// Product
	let productKey = configuration.productKey;
	if (!productKey) {
		let flightLevel = properties?.flightLevel?.toUpperCase();
		if (!flightLevel.startsWith("FL")) {
			flightLevel = "FL" + flightLevel;
		}
		switch (flightLevel) {
			case TemperatureAloftFlightLevels.FL050: productKey = "1210"; break;
			case TemperatureAloftFlightLevels.FL100: productKey = "1211"; break;
			case TemperatureAloftFlightLevels.FL140: productKey = "1212"; break;
			case TemperatureAloftFlightLevels.FL180: productKey = "1213"; break;
			case TemperatureAloftFlightLevels.FL240: productKey = "1214"; break;
			case TemperatureAloftFlightLevels.FL300: productKey = "1215"; break;
			case TemperatureAloftFlightLevels.FL340: productKey = "1216"; break;
			case TemperatureAloftFlightLevels.FL390: productKey = "1217"; break;
			case TemperatureAloftFlightLevels.FL450: productKey = "1218"; break;
			case TemperatureAloftFlightLevels.FL530: productKey = "1219"; break;
			default:
				throw new pangea.ArgumentError("configuration", "The provided flightLevel does not match a valid product.");
		}
	}

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey,
		keyZoomLevels: [0, 1, 2, 3, 4],
		validity: { backward: 8640000000000000, forward: 8640000000000000 },
		zoomRange: [0, 4]
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		if (!(feature instanceof pangea.data.PointFeature)) return [];
		const celsius = feature.properties.temperatureIsobaric;
		const fahrenheit = Math.floor((celsius * 9 / 5) + 32);
		const strokeColor = TEMPERATURE_ALOFT_PALETTE.convertToColor(fahrenheit);

		return [
			new pangea.overlays.CircleMarker(12, feature.geometry, {
				fill: { color: [22, 22, 22, 0.90] as any, opacity: 1 },
				stroke: { color: strokeColor, width: 1 }
			}),
			new pangea.overlays.TextMarker(fahrenheit.toString(), feature.geometry, {
				size: 12,
				color: [255, 255, 255, 1] as any,
				alignment: pangea.visuals.Alignment.CENTER
			})
		];
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		id: productKey + "-temperature-aloft-gfs-forecast-feature-layer",
		imageOverlapEnabled: true,
		textOverlapEnabled: true,
		styleFeature: style,
		meta: { temporalStatus: "forecast" }
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	// Preset
	let preset = new SunFeaturePreset(source, layer, configuration);
	return preset;
}

export function TemperatureAloftGfsVector(configuration: SunVectorConfiguration<TemperatureAloftProperties> = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Properties
	let defaultProperties: TemperatureAloftProperties = {
		flightLevel: TemperatureAloftFlightLevels.FL050
	};
	let properties = { ...defaultProperties, ...configuration.properties };

	// Product
	let productKey = configuration.productKey;
	if (!productKey) {
		let flightLevel = properties?.flightLevel?.toUpperCase();
		if (!flightLevel.startsWith("FL")) flightLevel = "FL" + flightLevel;
		switch (flightLevel) {
			case TemperatureAloftFlightLevels.FL050: productKey = "1210"; break;
			case TemperatureAloftFlightLevels.FL100: productKey = "1211"; break;
			case TemperatureAloftFlightLevels.FL140: productKey = "1212"; break;
			case TemperatureAloftFlightLevels.FL180: productKey = "1213"; break;
			case TemperatureAloftFlightLevels.FL240: productKey = "1214"; break;
			case TemperatureAloftFlightLevels.FL300: productKey = "1215"; break;
			case TemperatureAloftFlightLevels.FL340: productKey = "1216"; break;
			case TemperatureAloftFlightLevels.FL390: productKey = "1217"; break;
			case TemperatureAloftFlightLevels.FL450: productKey = "1218"; break;
			case TemperatureAloftFlightLevels.FL530: productKey = "1219"; break;
			default:
				throw new pangea.ArgumentError("configuration", "The provided flightLevel does not match a valid product.");
		}
	}

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-temperature-aloft-gfs-vector-source",
		validity: { backward: 8640000000000000, forward: 8640000000000000 },
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Style — fahrenheit conversion: F = C * 1.8 + 32
	const tempFExpr: any = ['round', ['+', ['*', ['get', 'temperatureIsobaric'], 1.8], 32]];
	const strokeColorExpr: any = [
		'step', tempFExpr,
		'#491d8b',
		-60, '#6929c6',
		-40, '#8a3ffc',
		-20, '#a56eff',
		  0, '#be95ff',
		 20, '#d4bbff',
		 40, '#ffb784',
		 60, '#ff832b',
		 80, '#eb6200',
		100, '#fa4d56',
		120, '#da1e28',
	];

	let style: any[] = [
		{
			id: productKey + "-temperature-aloft-vector-circles",
			type: "circle",
			filter: ["==", "$type", "Point"],
			paint: {
				"circle-radius": 8,
				"circle-color": "rgba(22, 22, 22, 0.90)",
				"circle-stroke-width": 1.5,
				"circle-stroke-color": strokeColorExpr,
				"circle-emissive-strength": 1,
			},
		},
		{
			id: productKey + "-temperature-aloft-vector-labels",
			type: "symbol",
			filter: ["==", "$type", "Point"],
			layout: {
				"text-field": ["to-string", tempFExpr],
				"text-size": 9,
				"text-allow-overlap": true,
				"text-ignore-placement": true,
			},
			paint: {
				"text-color": "#ffffff",
				"text-emissive-strength": 1,
			},
		},
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-temperature-aloft-gfs-vector-layer",
		meta: { temporalStatus: "forecast" },
		slot: 0,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	configuration.properties = properties;
	return new SunVectorPreset(source, layer, configuration);
}

//#endregion

//#region Additional Vector Presets

export function AirmetsGovernmentObservedVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6002";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-airmets-government-observed-vector-source",
		validity: { backward: 8640000000000000, forward: 8640000000000000 },
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style: any[] = [
		{
			id: "airmets-fill",
			type: "fill",
			layout: {
				"fill-sort-key": ["match", ["get", "phenomenon"],
					"SAND", 9, "CONV", 8, "VA", 7, "VIS", 6, "IFR", 5,
					"WIND", 4, "WINDS", 3, "TURB", 2, "ICING", 1, 0
				]
			},
			paint: {
				"fill-opacity": 0.4,
				"fill-emissive-strength": 1,
				"fill-color": ["match", ["get", "phenomenon"],
					"SAND",  ["rgba", 255, 0, 0, 1],
					"CONV",  ["rgba", 255, 0, 0, 1],
					"VA",    ["rgba", 255, 0, 0, 1],
					"VIS",   ["rgba", 255, 0, 0, 1],
					"IFR",   ["rgba", 255, 0, 0, 1],
					"DUST",  ["rgba", 255, 0, 0, 1],
					"WIND",  ["rgba", 255, 255, 255, 1],
					"WINDS", ["rgba", 255, 255, 255, 1],
					"TURB",  ["rgba", 255, 255, 0, 1],
					"ICING", ["rgba", 0, 255, 255, 1],
					["rgba", 0, 255, 0, 1]
				]
			}
		},
		{
			id: "airmets-line",
			type: "line",
			paint: {
				"line-opacity": 1,
				"line-emissive-strength": 1,
				"line-color": ["rgba", 128, 128, 128, 1],
				"line-width": 1
			}
		}
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-airmets-government-observed-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 1,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

export function SigmetsGovernmentVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6003";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-sigmets-government-vector-source",
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Shared phenomenon filter
	const phenomenaFilter = ["in", ["get", "phenomenon"], ["literal", [
		"CONV", "SQL TSGR", "EMBD TSGR", "ISOL TSGR", "OCNL TSGR", "FRQ TSGR",
		"SQL TS", "EMBD TS", "ISOL TS", "OCNL TS", "FRQ TS", "TSGR", "TS",
		"TC", "TCU", "CB", "FC", "WATERSPOUT",
		"TURB", "CAT", "MTW",
		"ICING", "RIME", "FZRA", "FZDZ", "FZFG", "ICE",
		"VA", "VASH", "VA CLD", "RDOACT CLD",
		"SAND", "SS", "BLSA",
		"WIND", "WINDS", "WS", "GUSTS",
		"DUST", "DS", "BLDU", "PO",
		"VIS", "CIG", "MT OBSC", "BKN CLD", "OVC CLD", "LOW CLD", "CLD", "BLSN", "SN", "IFR"
	]]];

	const phenomenaColorMatch = ["match", ["get", "phenomenon"],
		["CONV", "SQL TSGR", "EMBD TSGR", "ISOL TSGR", "OCNL TSGR", "FRQ TSGR",
			"SQL TS", "EMBD TS", "ISOL TS", "OCNL TS", "FRQ TS", "TSGR", "TS",
			"TC", "TCU", "CB", "FC", "WATERSPOUT"],
		["rgba", 255, 255, 255, 1],
		["TURB", "CAT", "MTW"],
		["rgba", 36, 161, 72, 1],
		["ICING", "RIME", "FZRA", "FZDZ", "FZFG", "ICE"],
		["rgba", 69, 137, 255, 1],
		["VA", "VASH", "VA CLD", "RDOACT CLD"],
		["rgba", 250, 77, 86, 1],
		["SAND", "SS", "BLSA"],
		["rgba", 250, 77, 86, 1],
		["WIND", "WINDS", "WS", "GUSTS"],
		["rgba", 255, 131, 43, 1],
		["DUST", "DS", "BLDU", "PO"],
		["rgba", 250, 77, 86, 1],
		["VIS", "CIG", "MT OBSC", "BKN CLD", "OVC CLD", "LOW CLD", "CLD", "BLSN", "SN", "IFR"],
		["rgba", 255, 126, 182, 1],
		["rgba", 255, 255, 255, 1]
	];

	const phenomenaFillColorMatch = ["match", ["get", "phenomenon"],
		["CONV", "SQL TSGR", "EMBD TSGR", "ISOL TSGR", "OCNL TSGR", "FRQ TSGR",
			"SQL TS", "EMBD TS", "ISOL TS", "OCNL TS", "FRQ TS", "TSGR", "TS",
			"TC", "TCU", "CB", "FC", "WATERSPOUT"],
		["rgba", 255, 255, 255, 0.1],
		["TURB", "CAT", "MTW"],
		["rgba", 36, 161, 72, 0.2],
		["ICING", "RIME", "FZRA", "FZDZ", "FZFG", "ICE"],
		["rgba", 69, 137, 255, 0.2],
		["VA", "VASH", "VA CLD", "RDOACT CLD"],
		["rgba", 250, 77, 86, 0.2],
		["SAND", "SS", "BLSA"],
		["rgba", 250, 77, 86, 0.2],
		["WIND", "WINDS", "WS", "GUSTS"],
		["rgba", 255, 131, 43, 0.2],
		["DUST", "DS", "BLDU", "PO"],
		["rgba", 250, 77, 86, 0.2],
		["VIS", "CIG", "MT OBSC", "BKN CLD", "OVC CLD", "LOW CLD", "CLD", "BLSN", "SN", "IFR"],
		["rgba", 255, 126, 182, 0.2],
		["rgba", 0, 0, 0, 0]
	];

	// Style
	let style: any[] = [
		{
			id: "sigmets-govt-fill",
			type: "fill",
			filter: phenomenaFilter,
			paint: {
				"fill-opacity": 1,
				"fill-emissive-strength": 1,
				"fill-color": phenomenaFillColorMatch,
			}
		},
		{
			id: "sigmets-govt-line",
			type: "line",
			filter: phenomenaFilter,
			paint: {
				"line-opacity": 1,
				"line-emissive-strength": 1,
				"line-color": phenomenaColorMatch,
				"line-dasharray": ["case",
					["in", ["get", "phenomenon"], ["literal", [
						"CONV", "SQL TSGR", "EMBD TSGR", "ISOL TSGR", "OCNL TSGR", "FRQ TSGR",
						"SQL TS", "EMBD TS", "ISOL TS", "OCNL TS", "FRQ TS", "TSGR", "TS",
						"TC", "TCU", "CB", "FC", "WATERSPOUT",
						"TURB", "CAT", "MTW",
						"ICING", "RIME", "FZRA", "FZDZ", "FZFG", "ICE",
						"VA", "VASH", "VA CLD", "RDOACT CLD",
						"SAND", "SS", "BLSA",
						"WIND", "WINDS", "WS", "GUSTS",
						"DUST", "DS", "BLDU", "PO",
						"VIS", "CIG", "MT OBSC", "BKN CLD", "OVC CLD", "LOW CLD", "CLD", "BLSN", "SN", "IFR"
					]]],
					["case",
						["has", "intensity_code"], ["case",
							[">", ["get", "intensity_code"], 0], [8, 2],
							[1, 0]
						],
						[1, 0]
					],
					[1, 0]
				],
				"line-width": ["case",
					["in", ["get", "phenomenon"], ["literal", ["VA", "VASH", "VA CLD", "RDOACT CLD"]]], 4,
					["in", ["get", "phenomenon"], ["literal", [
						"CONV", "TURB", "CAT", "MTW", "ICING", "RIME", "FZRA", "FZDZ", "FZFG", "ICE"
					]]],
					["case",
						["has", "intensity_code"], ["case",
							["<", ["get", "intensity_code"], 4], 1,
							["==", ["get", "intensity_code"], 4], 2,
							4
						],
						2
					],
					2
				]
			}
		}
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-sigmets-government-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 1,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

export function FpgsObservedVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6007";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-fpgs-observed-vector-source",
		validity: { backward: 8640000000000000, forward: 8640000000000000 },
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style: any[] = [
		{
			id: "fpgs-line",
			type: "line",
			filter: ["in", ["get", "phenomenon"], ["literal", ["CONV", "OZNE", "TURB", "ICNG", "ICING", "VASH", "VA", "BLDU", "DUST", "SPEC"]]],
			layout: {
				"line-sort-key": ["match", ["get", "phenomenon"],
					"CONV", 1, "OZNE", 2, "TURB", 3, "ICNG", 4, "ICING", 4, "VASH", 5, "VA", 5, "BLDU", 6, "DUST", 6, "SPEC", 7, 0
				]
			},
			paint: {
				"line-opacity": 1,
				"line-emissive-strength": 1,
				"line-color": ["match", ["get", "phenomenon"],
					"CONV",  ["rgba", 250, 77, 86, 1],
					"OZNE",  ["rgba", 255, 126, 182, 1],
					"TURB",  ["rgba", 36, 161, 72, 1],
					"ICNG",  ["rgba", 69, 137, 255, 1],
					"ICING", ["rgba", 69, 137, 255, 1],
					"VASH",  ["rgba", 255, 131, 0, 1],
					"VA",    ["rgba", 255, 131, 0, 1],
					"BLDU",  ["rgba", 255, 131, 0, 1],
					"DUST",  ["rgba", 255, 131, 0, 1],
					"SPEC",  ["rgba", 165, 110, 255, 1],
					["rgba", 165, 110, 255, 1]
				],
				"line-width": ["case",
					["in", ["get", "phenomenon"], ["literal", ["VASH"]]], 2,
					["in", ["get", "phenomenon"], ["literal", ["OZNE", "BLDU"]]], 1,
					["in", ["get", "phenomenon"], ["literal", ["CONV", "TURB", "ICNG", "SPEC"]]],
					["case",
						["has", "intensity_code"], ["case",
							["<", ["get", "intensity_code"], 4], 1,
							["==", ["get", "intensity_code"], 4], 2,
							4
						],
						2
					],
					["case",
						["has", "intensity_code"], ["case",
							["<", ["get", "intensity_code"], 4], 1,
							["==", ["get", "intensity_code"], 4], 2,
							4
						],
						2
					]
				],
				"line-dasharray": ["case",
					["in", ["get", "phenomenon"], ["literal", ["CONV", "TURB", "ICING", "ICNG", "SPEC"]]],
					["case",
						["has", "intensity_code"], ["case",
							["<", ["get", "intensity_code"], 4], [8, 2],
							[1, 0]
						],
						[1, 0]
					],
					["in", ["get", "phenomenon"], ["literal", ["OZNE"]]], [8, 2],
					["case",
						["has", "intensity_code"], ["case",
							["<", ["get", "intensity_code"], 4], [8, 2],
							[1, 0]
						],
						[1, 0]
					]
				]
			}
		}
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-fpgs-observed-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 1,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

export function IataEdrObservedVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6021";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-iata-edr-observed-vector-source",
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Style — severity circle + text labels for temperature and flight level
	let style: any[] = [
		{
			id: "iata-edr-severity",
			type: "circle",
			paint: {
				"circle-radius": [
					"interpolate", ["linear"], ["zoom"],
					3, 5,
					8, 9
				],
				"circle-color": [
					"step", ["get", "edr_peak"],
					"#808080",        // nil   (edr_peak < 0.15)
					0.15, "#3fb950",  // light (< 0.2)
					0.2, "#e3b341",  // medium/moderate (< 0.44)
					0.44, "#ff7b72"   // severe
				],
				"circle-stroke-color": ["rgba", 0, 0, 0, 0.6],
				"circle-stroke-width": 1,
				"circle-emissive-strength": 1
			}
		},
		{
			id: "iata-edr-text-temperature",
			type: "symbol",
			layout: {
				"symbol-avoid-edges": true,
				"symbol-placement": "point",
				"icon-allow-overlap": true,
				"text-allow-overlap": true,
				"text-anchor": "left",
				"text-size": 12,
				"text-field": ["get", "temperature"],
				"text-offset": [1, 0]
			},
			paint: {
				"text-color": ["rgba", 198, 198, 198, 1],
				"text-halo-color": ["rgba", 0, 0, 0, 1],
				"text-halo-width": 0.5,
				"text-emissive-strength": 1
			}
		},
		{
			id: "iata-edr-text-altitude",
			type: "symbol",
			layout: {
				"symbol-avoid-edges": true,
				"symbol-placement": "point",
				"icon-allow-overlap": true,
				"text-allow-overlap": true,
				"text-anchor": "right",
				"text-size": 12,
				"text-field": ["get", "flight_level"],
				"text-offset": [-1, 0]
			},
			paint: {
				"text-color": ["rgba", 198, 198, 198, 1],
				"text-halo-color": ["rgba", 0, 0, 0, 1],
				"text-halo-width": 0.5,
				"text-emissive-strength": 1
			}
		}
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-iata-edr-observed-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 0,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

export function OceanicTracksObservedVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6004";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-oceanic-tracks-observed-vector-source",
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Style
	const trackTypeFilter = ["in", ["get", "track_type"], ["literal", ["PACOT", "NAT", "AUSOT", "EPAC"]]];
	const trackColorMatch = ["match", ["get", "track_type"],
		"NAT",   ["rgba", 0, 102, 189, 1],
		"PACOT", ["rgba", 139, 65, 134, 1],
		"EPAC",  ["rgba", 36, 130, 96, 1],
		["rgba", 0, 255, 0, 1]
	];

	let style: any[] = [
		{
			id: "oceanic-tracks-line",
			type: "line",
			filter: trackTypeFilter,
			layout: {
				"line-sort-key": ["match", ["get", "track_type"],
					"PACOT", 1, "NAT", 2, "AUSOT", 3, "EPAC", 4, 0
				]
			},
			paint: {
				"line-opacity": 1,
				"line-emissive-strength": 1,
				"line-color": trackColorMatch,
				"line-width": 2
			}
		},
		{
			id: "oceanic-tracks-text",
			type: "symbol",
			filter: trackTypeFilter,
			layout: {
				"symbol-placement": "line-center",
				"symbol-spacing": 200,
				"text-anchor": "center",
				"text-allow-overlap": true,
				"text-ignore-placement": true,
				"text-size": ["interpolate", ["linear"], ["zoom"], 6, 12, 12, 20],
				"text-field": ["concat",
					["get", "track_type"], " ",
					["match", ["get", "track_direction"],
						"E", "East", "N", "North", "W", "West", "S", "South", ""
					], " ",
					["get", "track_id"]
				]
			},
			paint: {
				"text-color": ["rgba", 244, 244, 244, 1],
				"text-halo-color": ["rgba", 0, 0, 0, 1],
				"text-halo-width": 1,
				"text-emissive-strength": 1
			}
		}
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-oceanic-tracks-observed-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 1,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

export function RestrictedAirspacesObservedVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6027";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-restricted-airspaces-observed-vector-source",
		validity: { backward: 0, forward: 8640000000000000 },
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style: any[] = [
		{
			id: "restricted-airspaces-fill",
			type: "fill",
			filter: ["in", ["get", "restriction_type"], ["literal", ["L", "A", "C", "D", "M", "P", "R", "W"]]],
			layout: {
				"fill-sort-key": ["match", ["get", "status"],
					"H", 1, "W", 2, "P", 3, 0
				]
			},
			paint: {
				"fill-opacity": 1,
				"fill-emissive-strength": 1,
				"fill-color": ["match", ["get", "status"],
					"H", ["rgba", 218, 30, 40, 0.25],
					"W", ["rgba", 255, 131, 43, 0.25],
					"P", ["rgba", 241, 194, 27, 0.25],
					["rgba", 255, 255, 255, 0.2]
				]
			}
		},
		{
			id: "restricted-airspaces-line",
			type: "line",
			filter: ["in", ["get", "restriction_type"], ["literal", ["L", "A", "C", "D", "M", "P", "R", "W"]]],
			paint: {
				"line-opacity": 1,
				"line-emissive-strength": 1,
				"line-color": ["rgba", 0, 0, 0, 1],
				"line-width": 1
			}
		}
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-restricted-airspaces-observed-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 1,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

//#endregion

//#region Airways

export type AirwaysProperties = {
	showHigh?: boolean;
	showLow?:  boolean;
	showBoth?: boolean;
}

export function AirwaysObservedVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6029";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-airways-observed-vector-source",
		validity: { backward: 3000000000, forward: 3600000000 },
		zoomRange: [6, 25],
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Style
	let style: any[] = [
		{
			id: "airways-line",
			type: "line",
			paint: {
				"line-opacity": 1,
				"line-width": 1,
				"line-color": ["match", ["get", "airway_level"],
					"H", ["rgba", 0, 83, 154, 1],
					"L", ["rgba", 25, 128, 56, 1],
					"B", ["rgba", 0, 125, 121, 1],
					["rgba", 255, 255, 255, 1]
				],
				"line-emissive-strength": 1,
			},
		},
		{
			id: "airways-hitbox",
			type: "line",
			paint: {
				"line-opacity": 0,
				"line-width": 10,
				"line-color": "#FF00FF",
				"line-emissive-strength": 1,
			},
		},
		{
			id: "airways-labels",
			type: "symbol",
			paint: {
				"text-color": ["rgba", 244, 244, 244, 1],
				"text-halo-color": ["rgba", 0, 0, 0, 1],
				"text-halo-width": 0.5,
				"text-emissive-strength": 1,
			},
			layout: {
				"symbol-placement": "line",
				"symbol-spacing": 200,
				"text-anchor": "center",
				"text-allow-overlap": false,
				"text-size": 12,
				"text-field": ["step", ["zoom"], "", 7, ["get", "route_id"]],
				"text-offset": [1, 0],
			},
		},
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-airways-observed-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 0,
		zoomRange: [8, 25],
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

//#endregion

//#region Navaids

// Zoom-based step filter keyed on range_power_class — exported for use in controls
export const NAVAIDS_STEP_FILTER: any = ["case",
	["all", [">=", ["zoom"], 6], ["==", ["get", "range_power_class"], "H"]], true,
	["all", [">=", ["zoom"], 7], ["==", ["get", "range_power_class"], "L"]], true,
	["all", [">=", ["zoom"], 8], ["==", ["get", "range_power_class"], "T"]], true,
	["all", [">=", ["zoom"], 8], ["in", ["get", "range_power_class"], ["literal", ["U", "M", " ", ""]]]], true,
	false,
];

export function NavaidsObservedVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6020";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-navaids-observed-vector-source",
		validity: { backward: 3000000000, forward: 3600000000 },
		zoomRange: [1, 25],
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Icon + label combined in the same symbol so Mapbox places them as a unit.
	// Sprite names (navaids-*) must be registered in the viewport before the layer renders.
	const navaidLayout = {
		"symbol-placement": "point",
		"icon-allow-overlap": true,
		"icon-optional": true,
		"icon-anchor": "center",
		"icon-size": 1,
		"icon-image": ["match",
			["concat", ["get", "navaid_type1"], "-", ["get", "navaid_type2"]],
			"V-D", "navaids-vordme",
			"V-T", "navaids-vortac",
			"V- ", "navaids-vor",
			"H- ", "navaids-ndb",
			" -D", "navaids-dme",
			" -T", "navaids-tacan",
			"navaids-other",
		],
		"text-field": ["get", "navaid_id"],
		"text-anchor": "left",
		"text-offset": [1, 0],
		"text-size": 12,
		"text-allow-overlap": false,
	};

	const navaidPaint = {
		"text-color": ["rgba", 198, 198, 198, 1],
		"text-halo-color": ["rgba", 0, 0, 0, 1],
		"text-halo-width": 0.5,
		"text-emissive-strength": 1,
	};

	// Four symbol sublayers split by range_power_class (H/L/T/Other) so the
	// NavaidsControls toggles can rewrite each sublayer's filter independently.
	let style: any[] = [
		{
			id: "navaids-h",
			type: "symbol",
			minzoom: 5,
			filter: ["==", ["get", "range_power_class"], "H"],
			layout: navaidLayout,
			paint: navaidPaint,
		},
		{
			id: "navaids-l",
			type: "symbol",
			minzoom: 5,
			filter: ["==", ["get", "range_power_class"], "L"],
			layout: navaidLayout,
			paint: navaidPaint,
		},
		{
			id: "navaids-t",
			type: "symbol",
			minzoom: 5,
			filter: ["==", ["get", "range_power_class"], "T"],
			layout: navaidLayout,
			paint: navaidPaint,
		},
		{
			id: "navaids-other",
			type: "symbol",
			minzoom: 5,
			filter: ["in", ["get", "range_power_class"], ["literal", ["U", "M", " ", ""]]],
			layout: navaidLayout,
			paint: navaidPaint,
		},
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-navaids-observed-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 1,
		zoomRange: [1, 25],
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

//#endregion

//#region Waypoints

export function WaypointsObservedVector(configuration: SunVectorConfiguration = {}): SunVectorPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product
	let productKey = configuration.productKey ?? "6028";

	// Source
	let defaultSourceOptions: SunVectorSourceOptions = {
		id: productKey + "-waypoints-observed-vector-source",
		validity: { backward: 3000000000, forward: 3600000000 },
		zoomRange: [1, 25],
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunVectorSource(productKey, sunApiKey, sourceOptions);

	// Icons only — no text. Sprite names: waypoints-waypoint, waypoints-fix.
	// Sprite images must be registered in the viewport before the layer renders.
	const waypointIconLayout = {
		"symbol-placement": "point",
		"icon-allow-overlap": true,
		"icon-optional": true,
		"icon-anchor": "center",
		"icon-size": 1,
		"icon-image": ["match",
			["concat", ["get", "waypoint_type1"], ["get", "waypoint_type2"], ["get", "waypoint_type3"]],
			"M  ", "waypoints-waypoint",
			"N  ", "waypoints-waypoint",
			"O  ", "waypoints-waypoint",
			"W  ", "waypoints-waypoint",
			"WF ", "waypoints-waypoint",
			"W E", "waypoints-waypoint",
			"W F", "waypoints-waypoint",
			"W Z", "waypoints-waypoint",
			"W D", "waypoints-waypoint",
			"V  ", "waypoints-waypoint",
			"R  ", "waypoints-fix",
			"waypoints-fix",
		],
	};

	// Three icon sublayers by usage2 with staggered minzoom matching Maverick:
	// High (H/B) at zoom 6, Low (L/B) at zoom 7, Terminal (" "/T) at zoom 8.
	// "B" appears in both High and Low so toggling either still shows it via the other.
	// Labels are a separate sublayer appearing at zoom 8+ (same as Maverick).
	let style: any[] = [
		{
			id: "waypoints-high",
			type: "symbol",
			minzoom: 6,
			filter: ["in", ["get", "usage2"], ["literal", ["H", "B"]]],
			layout: waypointIconLayout,
		},
		{
			id: "waypoints-low",
			type: "symbol",
			minzoom: 7,
			filter: ["in", ["get", "usage2"], ["literal", ["L", "B"]]],
			layout: waypointIconLayout,
		},
		{
			id: "waypoints-terminal",
			type: "symbol",
			minzoom: 8,
			filter: ["in", ["get", "usage2"], ["literal", [" ", "T"]]],
			layout: waypointIconLayout,
		},
		{
			id: "waypoints-labels",
			type: "symbol",
			paint: {
				"text-color": ["rgba", 198, 198, 198, 1],
				"text-halo-color": ["rgba", 0, 0, 0, 1],
				"text-halo-width": 0.5,
				"text-emissive-strength": 1,
			},
			layout: {
				"text-allow-overlap": false,
				"text-anchor": "left",
				"text-size": 12,
				"text-field": ["step", ["zoom"], "", 8, ["get", "name"]],
				"text-offset": [1, 0],
			},
		},
	];

	// Layer
	let defaultLayerOptions: VectorLayerOptions = {
		id: productKey + "-waypoints-observed-vector-layer",
		meta: { temporalStatus: "observation" },
		slot: 1,
		zoomRange: [6, 25],
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.VectorLayer(source, style, layerOptions);

	return new SunVectorPreset(source, layer, configuration);
}

//#endregion

//#region Surface Airports

export type SurfaceAirportProperties = {
	displayMode?: "noStyle" | "flightRules" | "minVfrFlightRules";
}

export function SurfaceAirportsObservedFeature(configuration: SunFeatureConfiguration<SurfaceAirportProperties> = {}): SunFeaturePreset<SurfaceAirportProperties> {
	configuration = { ...configuration, properties: configuration.properties ?? {} as SurfaceAirportProperties };

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Properties
	let defaultProperties: SurfaceAirportProperties = {
		displayMode: "flightRules",
	};
	// Apply defaults into configuration.properties so the style closure reads live values
	configuration.properties = { ...defaultProperties, ...configuration.properties };

	// Product
	let productKey = configuration.productKey ?? "6022";

	// Source
	let defaultSourceOptions: SunFeatureSourceOptions = {
		id: productKey + "-surface-airports-observed-feature-source",
		validity: { backward: 3000000000, forward: 3000000000 },
		zoomRange: [0, 25],
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunFeatureSource(productKey, sunApiKey, sourceOptions);

	// Style
	const nonVfrRules = ["IFR", "LIFR", "MVFR", "CAT1", "BCAT", "BCAT1"];

	function getFlightRuleColor(flightRule: string | undefined): [number, number, number, number] {
		switch (flightRule) {
			case "VFR":              return [0, 170, 0, 1];
			case "MVFR":             return [0, 100, 204, 1];
			case "IFR":              return [204, 0, 0, 1];
			case "LIFR":             return [170, 0, 170, 1];
			case "CAT1":
			case "BCAT":
			case "BCAT1":            return [170, 0, 170, 1];
			default:                 return [136, 136, 136, 1];
		}
	}

	let style = configuration.layerOptions?.styleFeature ?? ((feature: Feature) => {
		if (!(feature instanceof pangea.data.PointFeature)) return [];

		const flightRule: string | undefined = feature.properties.flight_rule;
		const airportClass: string | undefined = feature.properties.class;
		const icao: string = feature.properties.airport_site_id ?? feature.properties.icao ?? feature.properties.id ?? "";
		const mode = (configuration.properties as SurfaceAirportProperties).displayMode ?? "flightRules";

		let startZoom: number;
		switch (airportClass) {
			case "B": startZoom = 1;  break;
			case "C": startZoom = 7;  break;
			case "D": startZoom = 9;  break;
			default:  startZoom = 12; break;
		}

		if (mode === "minVfrFlightRules") {
			const isNonVfr = flightRule && nonVfrRules.includes(flightRule);
			startZoom = isNonVfr ? 1 : 10;
		}

		const color: [number, number, number, number] = (mode === "noStyle")
			? [136, 136, 136, 1]
			: getFlightRuleColor(flightRule);

		const circleMarker = new pangea.overlays.CircleMarker(
			6,
			feature.geometry,
			{ fill: { color, opacity: 1 }, stroke: { color: [0, 0, 0, 1], opacity: 0.6 } },
			{ zoomRange: [startZoom, 25] }
		);

		const textMarker = new pangea.overlays.TextMarker(
			icao,
			feature.geometry,
			{
				color: [198, 198, 198, 1],
				anchor: pangea.visuals.Anchor.LEFT,
				offset: [10, 0],
				size: 12,
				stroke: { color: pangea.visuals.Color.BLACK, width: 0.5 },
			},
			{ zoomRange: [startZoom, 25] }
		);

		return [circleMarker, textMarker];
	});

	// Layer
	let defaultLayerOptions: FeatureLayerOptions = {
		id: productKey + "-surface-airports-observed-feature-layer",
		imageOverlapEnabled: true,
		textOverlapEnabled: false,
		styleFeature: style,
		meta: { temporalStatus: "observation" },
		slot: 1,
		zoomRange: [0, 25],
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.FeatureLayer(source, layerOptions);

	let preset = new SunFeaturePreset<SurfaceAirportProperties>(source, layer, configuration);
	return preset;
}

//#endregion

//#region GridLayer Presets

export function HighIceWaterContentForecastGrid(configuration: SunGridConfiguration = {}): SunGridPreset {

	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	const productKey = configuration.productKey ?? "390:HighIceWaterContent";

	let defaultSourceOptions: SunGridSourceOptions = {
		clientSideInterpolation: true,
		filter: "unfiltered(times) { return times; }",
		id: productKey + "-hiwc-forecast-grid-source",
		pollingRate: 60000,
		tileSize: { width: 512, height: 512 },
		tileLimit: 1500,
		validity: { backward: 108000000, forward: 108000000 },
		zoomRange: [0, 3],
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunGridSource(productKey, sunApiKey, sourceOptions);

	let style: GridRasterStyle | GridContourStyle = SunUtility.validateGridStyle(configuration);
	let styleId = "";

	if (configuration.style?.type === "GridRasterStyle") {
		styleId = "raster";
		let palette = configuration.style.palette ?? pangea.visuals.Palette.fromLike(AviationPalettes["high-ice-water-content-cm"]);

		let defaultStyleOptions: GridRasterStyleOptions = {};
		let styleOptions = { ...defaultStyleOptions, ...configuration.style.options };

		style = new pangea.visuals.GridRasterStyle(palette, styleOptions);
	}

	if (configuration.style?.type === "GridContourStyle") {
		styleId = "contour";
		let styleOptions = { ...configuration.style.options };
		style = new pangea.visuals.GridContourStyle(styleOptions);
	}

	let defaultLayerOptions: GridLayerOptions = {
		id: productKey + "-hiwc-forecast-grid-" + styleId + "-layer",
		meta: { temporalStatus: "forecast" },
		slot: 2,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.GridLayer(source, style, layerOptions);

	return new SunGridPreset(source, layer, configuration);
}

export function TurbulenceGtgForecastGrid(configuration: SunGridConfiguration<TurbulenceProperties> = {}): SunGridPreset<TurbulenceProperties> {
	
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	let defaultProperties: TurbulenceProperties = {
		elevationExaggeration: 0,
		flightLevel: TurbulenceFlightLevels.FL010
	};
	let properties = { ...defaultProperties, ...configuration.properties };

	let altitude: Distance = new pangea.geography.Distance(0);
	let productKey = configuration.productKey;
	if (!productKey) {		

		let flightLevel = properties?.flightLevel?.toUpperCase();
		if (!flightLevel.startsWith("FL")) {
			flightLevel = "FL" + flightLevel;
		}
		
		switch (flightLevel) { 
			case TurbulenceFlightLevels.FL010: productKey = "1950:GTGaltitudeabovemsl"; break;	
			case TurbulenceFlightLevels.FL020: productKey = "1951:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL030: productKey = "1952:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL040: productKey = "1953:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL050: productKey = "1954:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL060: productKey = "1955:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL070: productKey = "1956:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL080: productKey = "1957:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL090: productKey = "1958:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL100: productKey = "1959:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL110: productKey = "1960:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL120: productKey = "1961:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL130: productKey = "1962:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL140: productKey = "1963:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL150: productKey = "1964:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL160: productKey = "1965:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL170: productKey = "1966:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL180: productKey = "1967:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL190: productKey = "1968:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL200: productKey = "1969:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL210: productKey = "1970:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL220: productKey = "1971:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL230: productKey = "1972:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL240: productKey = "1973:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL250: productKey = "1974:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL260: productKey = "1975:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL270: productKey = "1976:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL280: productKey = "1977:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL290: productKey = "1978:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL300: productKey = "1979:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL310: productKey = "1980:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL320: productKey = "1981:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL330: productKey = "1982:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL340: productKey = "1983:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL350: productKey = "1984:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL360: productKey = "1985:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL370: productKey = "1986:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL380: productKey = "1987:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL390: productKey = "1988:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL400: productKey = "1989:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL410: productKey = "1990:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL420: productKey = "1991:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL430: productKey = "1992:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL440: productKey = "1993:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL450: productKey = "1994:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL460: productKey = "1995:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL470: productKey = "1996:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL480: productKey = "1997:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL490: productKey = "1998:GTGaltitudeabovemsl"; break;
			case TurbulenceFlightLevels.FL500: productKey = "1999:GTGaltitudeabovemsl"; break;
			default:
				throw new pangea.ArgumentError("configuration", "The provided flightLevel does not match a valid product.");
		}
		let altitudeFeet = Number.parseInt(flightLevel.substring(2)) * 1000;
		altitude = pangea.geography.Distance.fromFeet(altitudeFeet);
	}

	let defaultSourceOptions: SunGridSourceOptions = {
		clientSideInterpolation: true,
		filter: "unfiltered(times) { return times; }",
		id: productKey + "-turbulence-gtg-forecast-grid-source",
		pollingRate: 60000,
		tileSize: { width: 512, height: 512 },
		tileLimit: 1500,
		validity: { backward: 108000000, forward: 108000000 },
		zoomRange: [0, 3],
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let source = new pangea.sources.SunGridSource(productKey, sunApiKey, sourceOptions);

	let elevation = properties.elevationExaggeration * altitude.meters;
	let style: GridRasterStyle | GridContourStyle = SunUtility.validateGridStyle(configuration);
	let styleId = "";
	
	if (configuration.style?.type === "GridRasterStyle") {
		styleId = "raster"
		let palette = configuration.style.palette ?? pangea.visuals.Palette.fromLike(AviationPalettes["maverick-turbulence"]);
		let defaultStyleOptions: GridRasterStyleOptions = { elevation: elevation };
		let styleOptions = { ...defaultStyleOptions, ...configuration.style.options };
		style = new pangea.visuals.GridRasterStyle(palette, styleOptions);
	}

	if (configuration.style?.type === "GridContourStyle") {
		styleId = "contour";
		let styleOptions = { ...configuration.style.options };
		style = new pangea.visuals.GridContourStyle(styleOptions);
	}

	let defaultLayerOptions: GridLayerOptions = {
		id: productKey + "-turbulence-gtg-forecast-grid-" + styleId + "-layer",
		meta: { temporalStatus: "observed" },
		slot: 2,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.GridLayer(source, style, layerOptions);

	configuration.properties = properties;
	return new SunGridPreset(source, layer, configuration);
}

export function IcingPotentialFlightLevelsPacked(configuration: SunPackedConfiguration = {}): SunPackedPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product — variable-stacked pack of FIP icing potential at flight levels.
	let productKey = configuration.productKey ?? "fip_FLPacked:packed";

	// Source — the stack pack (tileSize defaults to 512). The PackedLayer renders this
	// source directly; the STACK extraction path serves the active layer (activeLayerIndex).
	let defaultSourceOptions: SunPackedSourceOptions = {
		id: productKey + "-icing-potential-flight-level-packed-source",
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let packedSource = new pangea.sources.SunPackedSource(productKey, sunApiKey, sourceOptions);

	// Style
	let palette = configuration.palettes?.["default"] ?? pangea.visuals.Palette.fromLike(AviationPalettes["icing-potential-fip"]);
	let style = new pangea.visuals.PackedRasterStyle({ grid: new pangea.visuals.GridRasterStyle(palette, {}) });

	// Layer
	let defaultLayerOptions: PackedLayerOptions = {
		id: productKey + "-icing-potential-flight-level-packed-layer",
		meta: { temporalStatus: "forecast" },
		slot: 2,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.PackedLayer(packedSource, style, layerOptions);

	// Preset — packedSource is also the data source; STACK extracts the active layer.
	return new SunPackedPreset(packedSource, packedSource, null, layer, configuration);
}

/**
 * EDR (Eddy Dissipation Rate) Turbulence at flight levels, variable-stacked ("stack") pack
 * (`edr_FLPacked`).
 *
 * A single packed tile holds every flight level; the active level is selected instantly
 * (cached re-extraction, no network re-fetch) via `layer.activeLayerIndex`. Available levels are
 * exposed by `preset.packedSource.packedLevels` once the source is ready.
 */
export function TurbulenceEdrFlightLevelsPacked(configuration: SunPackedConfiguration = {}): SunPackedPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product — EDR turbulence flight-level stack pack.
	let productKey = configuration.productKey ?? "edr_FLPacked:packed";

	// Source
	let defaultSourceOptions: SunPackedSourceOptions = {
		id: productKey + "-turbulence-edr-flight-level-packed-source",
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let packedSource = new pangea.sources.SunPackedSource(productKey, sunApiKey, sourceOptions);

	// Style — EDR turbulence ramp (small 0–~0.5 range; see "edr-turbulence" palette).
	let palette = configuration.palettes?.["default"] ?? pangea.visuals.Palette.fromLike(AviationPalettes["edr-turbulence"]);
	let style = new pangea.visuals.PackedRasterStyle({ grid: new pangea.visuals.GridRasterStyle(palette, {}) });

	// Layer
	let defaultLayerOptions: PackedLayerOptions = {
		id: productKey + "-turbulence-edr-flight-level-packed-layer",
		meta: { temporalStatus: "forecast" },
		slot: 2,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.PackedLayer(packedSource, style, layerOptions);

	// Preset — packedSource is also the data source; STACK extracts the active layer.
	return new SunPackedPreset(packedSource, packedSource, null, layer, configuration);
}

/**
 * GTG (Graphical Turbulence Guidance) at flight levels, variable-stacked ("stack") pack
 * (`packed_GTG`).
 *
 * A single packed tile holds every flight level; the active level is selected instantly
 * (cached re-extraction, no network re-fetch) via `layer.activeLayerIndex`. Available levels are
 * exposed by `preset.packedSource.packedLevels` once the source is ready.
 */
export function TurbulenceGtgFlightLevelsPacked(configuration: SunPackedConfiguration = {}): SunPackedPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product — GTG turbulence flight-level stack pack.
	let productKey = configuration.productKey ?? "packed_GTG:packed";

	// Source
	let defaultSourceOptions: SunPackedSourceOptions = {
		id: productKey + "-turbulence-gtg-flight-level-packed-source",
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let packedSource = new pangea.sources.SunPackedSource(productKey, sunApiKey, sourceOptions);

	// Style — GTG turbulence severity index (0–7; measured values 1–4). NONE-interpolation ramp;
	// smooth air (0) is transparent so only turbulent regions paint.
	let palette = configuration.palettes?.["default"] ?? pangea.visuals.Palette.fromLike(AviationPalettes["maverick-turbulence"]);
	let style = new pangea.visuals.PackedRasterStyle({ grid: new pangea.visuals.GridRasterStyle(palette, {}) });

	// Layer
	let defaultLayerOptions: PackedLayerOptions = {
		id: productKey + "-turbulence-gtg-flight-level-packed-layer",
		meta: { temporalStatus: "forecast" },
		slot: 2,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.PackedLayer(packedSource, style, layerOptions);

	// Preset — packedSource is also the data source; STACK extracts the active layer.
	return new SunPackedPreset(packedSource, packedSource, null, layer, configuration);
}

/**
 * Contrail Formation Risk at flight levels, variable-stacked ("stack") pack
 * (`packed_FLContrail`).
 *
 * A single packed tile holds every flight level; the active level is selected instantly
 * (cached re-extraction, no network re-fetch) via `layer.activeLayerIndex`. Available levels are
 * exposed by `preset.packedSource.packedLevels` once the source is ready.
 *
 * Values are categorical (0 none / 1 non-persistent / 2 persistent), present only at high flight
 * levels (~FL300+); styled with the categorical "contrail-risk" palette.
 */
export function ContrailFlightLevelsPacked(configuration: SunPackedConfiguration = {}): SunPackedPreset {

	// API Key
	let sunApiKey = SunUtility.validateSunApiKey(configuration.sunApiKey);

	// Product — contrail formation risk flight-level stack pack.
	let productKey = configuration.productKey ?? "packed_FLContrail:packed";

	// Source
	let defaultSourceOptions: SunPackedSourceOptions = {
		id: productKey + "-contrail-flight-level-packed-source",
	};
	let sourceOptions = { ...defaultSourceOptions, ...configuration.sourceOptions };
	let packedSource = new pangea.sources.SunPackedSource(productKey, sunApiKey, sourceOptions);

	// Style — categorical contrail risk (0 none / 1 non-persistent / 2 persistent, NONE interpolation; see "contrail-risk" palette).
	let palette = configuration.palettes?.["default"] ?? pangea.visuals.Palette.fromLike(AviationPalettes["contrail-risk"]);
	let style = new pangea.visuals.PackedRasterStyle({ grid: new pangea.visuals.GridRasterStyle(palette, {}) });

	// Layer
	let defaultLayerOptions: PackedLayerOptions = {
		id: productKey + "-contrail-flight-level-packed-layer",
		meta: { temporalStatus: "forecast" },
		slot: 2,
	};
	let layerOptions = { ...defaultLayerOptions, ...configuration.layerOptions };
	let layer = new pangea.layers.PackedLayer(packedSource, style, layerOptions);

	// Preset — packedSource is also the data source; STACK extracts the active layer.
	return new SunPackedPreset(packedSource, packedSource, null, layer, configuration);
}

//#endregion


