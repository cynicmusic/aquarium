// Chromatophore Shader Reference — from user
// This implements Worley-noise based chromatophore animation
// Each Worley cell = one chromatophore pigment sac
// The distance function modulation = expansion/contraction of sacs

#define saturate(x) clamp(x, 0.0, 1.0)

vec3 rgb2hsv(vec3 rgb)
{
	float Cmax = max(rgb.r, max(rgb.g, rgb.b));
	float Cmin = min(rgb.r, min(rgb.g, rgb.b));
    float delta = Cmax - Cmin;

	vec3 hsv = vec3(0., 0., Cmax);

	if (Cmax > Cmin)
	{
		hsv.y = delta / Cmax;

		if (rgb.r == Cmax)
			hsv.x = (rgb.g - rgb.b) / delta;
		else
		{
			if (rgb.g == Cmax)
				hsv.x = 2. + (rgb.b - rgb.r) / delta;
			else
				hsv.x = 4. + (rgb.r - rgb.g) / delta;
		}
		hsv.x = fract(hsv.x / 6.);
	}
	return hsv;
}

float chromaKey(vec3 color)
{
	vec3 backgroundColor = vec3(0.157, 0.576, 0.129);
	vec3 weights = vec3(4., 1., 2.);

	vec3 hsv = rgb2hsv(color);
	vec3 target = rgb2hsv(backgroundColor);
	float dist = length(weights * (target - hsv));
	return 1. - clamp(3. * dist - 1.5, 0., 1.);
}

vec2 hash2( vec2 p )
{
    const vec2 k = vec2( 0.3183099, 0.23678794 );
    p = p*k + k.yx;
    return fract( 13.0 * k * fract(p.x*p.y*(p.x+p.y)));
}

float worleyDistance(vec2 p, vec2 c, float scale)
{
    vec2 uv = p / scale;

    float r = texture(iChannel1, vec2(iTime, 0.0) * .05 + uv * vec2(.3, 1.0)).r;
    r *= texture(iChannel1, vec2(r * .5) + uv).r;

    vec3 britney = texture(iChannel0, c * vec2(1.0, 2.0) / scale).rgb;
    float key = length(1.0 - chromaKey(britney));
    r += length(britney) * key * .65 + key * .2;

    r *= .6;
    r = max(r, .0001);

    return length(p - c) / r;
}

vec3 worley(vec2 uv, float scale)
{
    vec2 p = floor(uv * scale);

    vec2 p1 = p + vec2(0.0, 0.0);  p1 += hash2(p) * .5;
    vec2 p2 = p + vec2(1.0, 0.0);  p2 += hash2(p2) * .5;
    vec2 p3 = p + vec2(1.0, 1.0);  p3 += hash2(p3) * .5;
    vec2 p4 = p + vec2(0.0, 1.0);  p4 += hash2(p4) * .5;
    vec2 p5 = p + vec2(-1.0, 0.0); p5 += hash2(p5) * .5;
    vec2 p6 = p + vec2(-1.0, -1.0);p6 += hash2(p6) * .5;
    vec2 p7 = p + vec2(0.0, -1.0); p7 += hash2(p7) * .5;
    vec2 p8 = p + vec2(-1.0, 1.0); p8 += hash2(p8) * .5;
    vec2 p9 = p + vec2(1.0, -1.0); p9 += hash2(p9) * .5;

    p = uv * scale;

    float d1 = worleyDistance(p, p1, scale);
    float d2 = worleyDistance(p, p2, scale);
    float d3 = worleyDistance(p, p3, scale);
    float d4 = worleyDistance(p, p4, scale);
    float d5 = worleyDistance(p, p5, scale);
    float d6 = worleyDistance(p, p6, scale);
    float d7 = worleyDistance(p, p7, scale);
    float d8 = worleyDistance(p, p8, scale);
    float d9 = worleyDistance(p, p9, scale);

    float d = d1;
    d = min(d, d2); d = min(d, d3); d = min(d, d4);
    d = min(d, d5); d = min(d, d6); d = min(d, d7);
    d = min(d, d8); d = min(d, d9);

    vec2 closest = p1;
    closest = mix(closest, p2, step(abs(d - d2), 0.0));
    closest = mix(closest, p3, step(abs(d - d3), 0.0));
    closest = mix(closest, p4, step(abs(d - d4), 0.0));
    closest = mix(closest, p5, step(abs(d - d5), 0.0));
    closest = mix(closest, p6, step(abs(d - d6), 0.0));
    closest = mix(closest, p7, step(abs(d - d7), 0.0));
    closest = mix(closest, p8, step(abs(d - d8), 0.0));
    closest = mix(closest, p9, step(abs(d - d9), 0.0));

    return vec3(1. - d, closest);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.x;
    float scale = 50.0;
    float d = worley(uv, scale).r;
    fragColor = vec4(1.0 - step(.0, d));
}
