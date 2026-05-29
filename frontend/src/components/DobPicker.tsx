import React, { useEffect, useState } from 'react';
import { IonSelect, IonSelectOption, IonLabel } from '@ionic/react';

interface Props {
  value: string;           // YYYY-MM-DD or ''
  onChange: (val: string) => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: currentYear - 1919 }, (_, i) => currentYear - i);

const DobPicker: React.FC<Props> = ({ value, onChange }) => {
  const [day,   setDay]   = useState<number | ''>('');
  const [month, setMonth] = useState<number | ''>('');  // 1-12
  const [year,  setYear]  = useState<number | ''>('');

  // Initialise from external value (YYYY-MM-DD)
  useEffect(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number);
      setYear(y); setMonth(m); setDay(d);
    } else if (!value) {
      setDay(''); setMonth(''); setYear('');
    }
  }, [value]);

  const emit = (d: number | '', m: number | '', y: number | '') => {
    if (d && m && y) {
      const maxDay = daysInMonth(m as number, y as number);
      const safeDay = Math.min(d as number, maxDay);
      onChange(
        `${y}-${String(m).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`
      );
    } else {
      onChange('');
    }
  };

  const maxDay = month && year ? daysInMonth(month as number, year as number) : 31;
  const days   = Array.from({ length: maxDay }, (_, i) => i + 1);

  const handleDay   = (v: number) => { setDay(v);   emit(v, month, year); };
  const handleMonth = (v: number) => { setMonth(v); emit(day, v, year);   };
  const handleYear  = (v: number) => { setYear(v);  emit(day, month, v);  };

  const selectStyle: React.CSSProperties = { minWidth: 0, flex: 1 };

  return (
    <div>
      <IonLabel style={{ fontSize: '0.75rem', color: '#666', paddingLeft: '16px', display: 'block', marginBottom: '4px' }}>
        Date of Birth
      </IonLabel>
      <div style={{ display: 'flex', gap: '6px', padding: '0 16px 8px' }}>
        <IonSelect
          placeholder="Day"
          value={day || null}
          onIonChange={(e) => handleDay(Number(e.detail.value))}
          interface="popover"
          style={selectStyle}
        >
          {days.map(d => (
            <IonSelectOption key={d} value={d}>{d}</IonSelectOption>
          ))}
        </IonSelect>

        <IonSelect
          placeholder="Month"
          value={month || null}
          onIonChange={(e) => handleMonth(Number(e.detail.value))}
          interface="popover"
          style={selectStyle}
        >
          {MONTHS.map((name, i) => (
            <IonSelectOption key={i + 1} value={i + 1}>{name}</IonSelectOption>
          ))}
        </IonSelect>

        <IonSelect
          placeholder="Year"
          value={year || null}
          onIonChange={(e) => handleYear(Number(e.detail.value))}
          interface="popover"
          style={{ ...selectStyle, flex: 1.3 }}
        >
          {YEARS.map(y => (
            <IonSelectOption key={y} value={y}>{y}</IonSelectOption>
          ))}
        </IonSelect>
      </div>
    </div>
  );
};

export default DobPicker;
