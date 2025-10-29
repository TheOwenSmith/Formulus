#!/usr/bin/env python3
"""
Check for missing data in CSV files
"""

import pandas as pd
import os
import glob
from datetime import datetime, timedelta
import pytz

def check_missing_data(csv_file_path):
    """Check a single CSV file for missing data"""
    print(f"\n🔍 Checking: {os.path.basename(csv_file_path)}")
    
    try:
        # Read the CSV file
        df = pd.read_csv(csv_file_path)
        
        # Check if timestamp column exists
        if 'timestamp' not in df.columns:
            print(f"❌ No 'timestamp' column found")
            return
        
        # Convert timestamp to datetime
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values('timestamp')
        
        print(f"📊 Total records: {len(df):,}")
        print(f"📅 Date range: {df['timestamp'].min()} to {df['timestamp'].max()}")
        
        # Check for duplicate timestamps
        duplicates = df['timestamp'].duplicated()
        if duplicates.any():
            print(f"⚠️  Found {duplicates.sum()} duplicate timestamps")
            duplicate_times = df[duplicates]['timestamp'].unique()
            print(f"   Duplicate times: {duplicate_times[:5]}...")  # Show first 5
        
        # Check for missing values in OHLCV columns
        ohlcv_columns = ['open', 'high', 'low', 'close', 'volume']
        missing_data = {}
        for col in ohlcv_columns:
            if col in df.columns:
                missing_count = df[col].isna().sum()
                if missing_count > 0:
                    missing_data[col] = missing_count
        
        if missing_data:
            print(f"❌ Missing data found:")
            for col, count in missing_data.items():
                print(f"   {col}: {count} missing values")
        else:
            print(f"✅ No missing OHLCV data")
        
        # Check for gaps in time series (only within trading hours)
        if len(df) > 1:
            # Calculate expected time intervals
            time_diffs = df['timestamp'].diff().dropna()
            
            # Get the most common interval (mode)
            most_common_interval = time_diffs.mode().iloc[0] if len(time_diffs.mode()) > 0 else None
            
            if most_common_interval:
                print(f"⏱️  Most common interval: {most_common_interval}")
                
                # Find gaps larger than expected, but only within trading hours
                expected_interval = most_common_interval
                large_gaps = time_diffs[time_diffs > expected_interval * 1.5]  # Allow 50% tolerance
                
                # Filter gaps to only include those within trading hours (9:30 AM - 4:00 PM ET)
                trading_gaps = []
                for gap_idx in large_gaps.index:
                    gap = large_gaps[gap_idx]
                    gap_start = df.loc[gap_idx - 1, 'timestamp']
                    gap_end = df.loc[gap_idx, 'timestamp']
                    
                    # Check if both timestamps are within trading hours (9:30 AM - 4:00 PM ET)
                    start_hour = gap_start.hour
                    start_minute = gap_start.minute
                    end_hour = gap_end.hour
                    end_minute = gap_end.minute
                    
                    # Convert to minutes since midnight for easier comparison
                    start_minutes = start_hour * 60 + start_minute
                    end_minutes = end_hour * 60 + end_minute
                    
                    # Trading hours: 9:30 AM (570 minutes) to 4:00 PM (960 minutes)
                    trading_start = 9 * 60 + 30  # 9:30 AM
                    trading_end = 16 * 60        # 4:00 PM
                    
                    # Check if gap is within trading hours
                    if (trading_start <= start_minutes <= trading_end and 
                        trading_start <= end_minutes <= trading_end):
                        trading_gaps.append((gap_start, gap_end, gap))
                
                if len(trading_gaps) > 0:
                    print(f"⚠️  Found {len(trading_gaps)} gaps within trading hours:")
                    for i, (gap_start, gap_end, gap) in enumerate(trading_gaps[:5]):  # Show first 5 gaps
                        print(f"   Gap {i+1}: {gap_start} → {gap_end} (duration: {gap})")
                else:
                    print(f"✅ No significant gaps found within trading hours")
        
        # Check for suspicious values
        suspicious_values = {}
        for col in ['open', 'high', 'low', 'close']:
            if col in df.columns:
                # Check for zero or negative prices
                zero_or_negative = (df[col] <= 0).sum()
                if zero_or_negative > 0:
                    suspicious_values[f"{col}_zero_or_negative"] = zero_or_negative
                
                # Check for extremely high prices (>$10,000)
                extremely_high = (df[col] > 10000).sum()
                if extremely_high > 0:
                    suspicious_values[f"{col}_extremely_high"] = extremely_high
        
        if 'volume' in df.columns:
            # Check for negative volume
            negative_volume = (df['volume'] < 0).sum()
            if negative_volume > 0:
                suspicious_values['volume_negative'] = negative_volume
        
        if suspicious_values:
            print(f"⚠️  Suspicious values found:")
            for issue, count in suspicious_values.items():
                print(f"   {issue}: {count} occurrences")
        else:
            print(f"✅ No suspicious values found")
        
        # Check OHLC relationships
        if all(col in df.columns for col in ['open', 'high', 'low', 'close']):
            invalid_ohlc = (
                (df['high'] < df['low']) |
                (df['high'] < df['open']) |
                (df['high'] < df['close']) |
                (df['low'] > df['open']) |
                (df['low'] > df['close'])
            ).sum()
            
            if invalid_ohlc > 0:
                print(f"❌ Found {invalid_ohlc} invalid OHLC relationships")
            else:
                print(f"✅ All OHLC relationships are valid")
        
        return {
            'file': os.path.basename(csv_file_path),
            'total_records': len(df),
            'date_range': (df['timestamp'].min(), df['timestamp'].max()),
            'duplicates': duplicates.sum(),
            'missing_data': missing_data,
            'suspicious_values': suspicious_values,
            'invalid_ohlc': invalid_ohlc if 'invalid_ohlc' in locals() else 0
        }
        
    except Exception as e:
        print(f"❌ Error reading file: {e}")
        return None

def main():
    """Main function to check all CSV files in the data directory"""
    print("🔍 CSV Data Quality Checker")
    print("=" * 50)
    
    # Find all CSV files in the data directory
    data_dir = './data'
    csv_files = glob.glob(os.path.join(data_dir, '*.csv'))
    
    if not csv_files:
        print(f"❌ No CSV files found in {data_dir}")
        return
    
    print(f"📁 Found {len(csv_files)} CSV files to check")
    
    results = []
    for csv_file in sorted(csv_files):
        result = check_missing_data(csv_file)
        if result:
            results.append(result)
    
    # Summary report
    print(f"\n📋 SUMMARY REPORT")
    print("=" * 50)
    
    total_files = len(results)
    files_with_issues = sum(1 for r in results if (
        r['duplicates'] > 0 or 
        r['missing_data'] or 
        r['suspicious_values'] or 
        r['invalid_ohlc'] > 0
    ))
    
    print(f"📊 Files checked: {total_files}")
    print(f"⚠️  Files with issues: {files_with_issues}")
    print(f"✅ Files clean: {total_files - files_with_issues}")
    
    if files_with_issues > 0:
        print(f"\n🚨 Files with issues:")
        for result in results:
            has_issues = (
                result['duplicates'] > 0 or 
                result['missing_data'] or 
                result['suspicious_values'] or 
                result['invalid_ohlc'] > 0
            )
            if has_issues:
                print(f"   • {result['file']}")
                if result['duplicates'] > 0:
                    print(f"     - {result['duplicates']} duplicate timestamps")
                if result['missing_data']:
                    print(f"     - Missing data: {result['missing_data']}")
                if result['suspicious_values']:
                    print(f"     - Suspicious values: {result['suspicious_values']}")
                if result['invalid_ohlc'] > 0:
                    print(f"     - {result['invalid_ohlc']} invalid OHLC relationships")
    
    print(f"\n✅ Data quality check complete!")

if __name__ == "__main__":
    main()
