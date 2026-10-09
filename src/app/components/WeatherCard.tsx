import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { AlertTriangle, Cloud, CloudLightning, CloudRain, Droplets, Moon, Sun, Thermometer, Wind } from 'lucide-react';
import type { WindyWeather } from '../utils/windyApi';
import type { WeatherTheme } from '../utils/weatherTheme';

type WeatherCardProps = {
  weather: WindyWeather;
  theme: WeatherTheme;
  forecastLabels: string[];
  placeTitle: string;
};

function useCountUp(value: number | null, duration = 800) {
  const [displayValue, setDisplayValue] = useState(value ?? 0);
  const currentValue = useRef(value ?? 0);

  useEffect(() => {
    if (value === null) {
      setDisplayValue(0);
      currentValue.current = 0;
      return;
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      setDisplayValue(value);
      currentValue.current = value;
      return;
    }

    let frame = 0;
    let startTime: number | undefined;
    const startValue = currentValue.current;
    const animate = (time: number) => {
      if (startTime === undefined) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      const nextValue = startValue + (value - startValue) * easedProgress;
      currentValue.current = nextValue;
      setDisplayValue(nextValue);
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [value, duration]);

  return value === null ? null : Math.round(displayValue);
}

type WeatherParticle = {
  left: string;
  top: string;
  delay: string;
  duration: string;
  opacity: number;
};

function createParticles(count: number, durationRange: [number, number]): WeatherParticle[] {
  return Array.from({ length: count }, (_, index) => {
    const random = (seed: number) => {
      const value = Math.sin((index + 1) * seed) * 10000;
      return value - Math.floor(value);
    };
    const duration = durationRange[0] + random(12.9898) * (durationRange[1] - durationRange[0]);
    return {
      left: `${(random(78.233) * 100).toFixed(2)}%`,
      top: `${(random(39.425) * 100).toFixed(2)}%`,
      delay: `${(-random(11.135) * duration).toFixed(2)}s`,
      duration: `${duration.toFixed(2)}s`,
      opacity: 0.35 + random(19.19) * 0.55,
    };
  });
}

export function WeatherBackground({ theme }: { theme: WeatherTheme }) {
  const rainDrops = useMemo(() => createParticles(theme.name === 'storm' ? 90 : 60, theme.name === 'storm' ? [0.55, 1.1] : [0.9, 1.8]), [theme.name]);
  const stars = useMemo(() => createParticles(40, [1.8, 4.5]), []);

  return (
    <div className={`weather-iphone-background weather-scene-${theme.name}`} aria-hidden="true">
      {theme.name === 'sun' && (
        <>
          <span className="weather-iphone-sun-glow" />
          <span className="weather-iphone-sun" />
          <span className="weather-iphone-cloud weather-iphone-cloud-one" />
          <span className="weather-iphone-cloud weather-iphone-cloud-two" />
        </>
      )}
      {theme.name === 'cloudy' && (
        <>
          <span className="weather-iphone-cloud weather-iphone-cloud-one" />
          <span className="weather-iphone-cloud weather-iphone-cloud-two" />
          <span className="weather-iphone-cloud weather-iphone-cloud-three" />
        </>
      )}
      {(theme.name === 'rain' || theme.name === 'storm') && (
        <>
          <span className="weather-iphone-dark-cloud weather-iphone-cloud-one" />
          <span className="weather-iphone-dark-cloud weather-iphone-cloud-two" />
          <span className="weather-iphone-rainfall">
            {rainDrops.map((drop, index) => <i key={index} style={{ left: drop.left, top: drop.top, animationDelay: drop.delay, animationDuration: drop.duration, opacity: drop.opacity }} />)}
          </span>
          {theme.name === 'storm' && <span className="weather-iphone-flash"><CloudLightning /></span>}
        </>
      )}
      {theme.name === 'night' && (
        <>
          <span className="weather-iphone-stars">
            {stars.map((star, index) => <i key={index} style={{ left: star.left, top: star.top, animationDelay: star.delay, animationDuration: star.duration, opacity: star.opacity }} />)}
          </span>
          <span className="weather-iphone-shooting-star" />
          <span className="weather-iphone-moon" />
        </>
      )}
    </div>
  );
}

export default function WeatherCard({ weather, theme, forecastLabels, placeTitle }: WeatherCardProps) {
  const animatedTemperature = useCountUp(weather.currentTemperature);
  const updateTime = new Date(weather.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const WeatherIcon = theme.name === 'sun' ? Sun
    : theme.name === 'night' ? Moon
      : theme.name === 'storm' ? CloudLightning
        : theme.name === 'rain' ? CloudRain : Cloud;

  return (
    <section
      className={`weather-iphone-card weather-theme-${theme.name}`}
      style={{ background: theme.background, color: theme.text, '--weather-cloud': theme.cloud } as CSSProperties}
    >
      <WeatherBackground theme={theme} />
      <div className="weather-iphone-content">
        <header className="weather-iphone-header">
          <div>
            <p className="weather-iphone-eyebrow">พยากรณ์อากาศ</p>
            <h3 className="weather-iphone-title">พยากรณ์อากาศ ({placeTitle})</h3>
          </div>
          <p className="weather-iphone-updated">อัปเดตล่าสุด {updateTime} น.</p>
        </header>

        <div className="weather-iphone-current">
          <div className="weather-iphone-temperature">
            <span>{animatedTemperature !== null ? `${animatedTemperature}°` : '—'}</span>
            <div>
              <WeatherIcon className="weather-iphone-current-icon" />
              <p>{theme.label}</p>
            </div>
          </div>
          <div className="weather-iphone-stats">
            <div className="weather-iphone-stat"><CloudRain /><span>ฝนวันนี้<strong>{weather.rain[0] != null ? `${weather.rain[0]}%` : 'ไม่มีข้อมูล'}</strong></span></div>
            <div className="weather-iphone-stat"><Wind /><span>ความเร็วลม<strong>{weather.wind} กม./ชม.</strong></span></div>
            <div className="weather-iphone-stat"><Droplets /><span>ความชื้น<strong>{weather.humidity != null ? `${weather.humidity}%` : 'ไม่มีข้อมูล'}</strong></span></div>
            <div className="weather-iphone-stat"><Thermometer /><span>ฝนปัจจุบัน<strong>{weather.currentRain.toFixed(1)} มม.</strong></span></div>
          </div>
        </div>

        <div className="weather-iphone-forecast">
          {forecastLabels.map((label, index) => (
            <article className="weather-iphone-day" key={label} style={{ animationDelay: `${120 + index * 70}ms` }}>
              <p>{label}</p>
              {theme.name === 'sun' ? <Sun /> : theme.name === 'night' ? <Moon /> : theme.name === 'storm' ? <CloudLightning /> : theme.name === 'rain' ? <CloudRain /> : <Cloud />}
              <strong>{weather.temperatures[index] != null ? `${weather.temperatures[index]}°` : '—'}</strong>
              <span>ฝน {weather.rain[index] != null ? `${weather.rain[index]}%` : '—'}</span>
            </article>
          ))}
        </div>

        <div className="weather-iphone-caution" style={{ animationDelay: '360ms' }}>
          <AlertTriangle />
          <p>{theme.caution}</p>
        </div>
      </div>
    </section>
  );
}
