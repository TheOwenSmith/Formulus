export const RUNNER_CPP_BATCHED_FROM_FILENAMES = (
  filenames: string[],
  files?: Record<string, string>,
) => `
#include <iostream>
#include <fstream>
#include <string>
#include <vector>
#include <map>
#include <future>
#include <thread>
#include <sstream>
#include <cctype>

// Lightweight JSON parser - only handles what we need
class SimpleJson {
public:
    enum Type { OBJECT, ARRAY, STRING, NUMBER, BOOL, NULL_VAL };
    Type type;
    std::map<std::string, SimpleJson> obj;
    std::vector<SimpleJson> arr;
    std::string str;
    double num;
    bool b;
    
    SimpleJson() : type(NULL_VAL), num(0), b(false) {}
    
    static SimpleJson parse(const std::string& json_str) {
        size_t pos = 0;
        return parseValue(json_str, pos);
    }
    
    static SimpleJson parseValue(const std::string& s, size_t& pos) {
        skipWhitespace(s, pos);
        if (pos >= s.length()) return SimpleJson();
        
        if (s[pos] == '{') return parseObject(s, pos);
        if (s[pos] == '[') return parseArray(s, pos);
        if (s[pos] == '"') return parseString(s, pos);
        if (s[pos] == 't' || s[pos] == 'f') return parseBool(s, pos);
        if (s[pos] == 'n') { pos += 4; return SimpleJson(); }
        if (std::isdigit(s[pos]) || s[pos] == '-') return parseNumber(s, pos);
        return SimpleJson();
    }
    
    static SimpleJson parseObject(const std::string& s, size_t& pos) {
        SimpleJson obj;
        obj.type = OBJECT;
        pos++; // skip '{'
        skipWhitespace(s, pos);
        
        while (pos < s.length() && s[pos] != '}') {
            skipWhitespace(s, pos);
            if (s[pos] == '}') break;
            
            std::string key = parseString(s, pos).str;
            skipWhitespace(s, pos);
            if (s[pos] != ':') break;
            pos++; // skip ':'
            obj.obj[key] = parseValue(s, pos);
            skipWhitespace(s, pos);
            if (s[pos] == ',') pos++;
        }
        if (pos < s.length() && s[pos] == '}') pos++;
        return obj;
    }
    
    static SimpleJson parseArray(const std::string& s, size_t& pos) {
        SimpleJson arr;
        arr.type = ARRAY;
        pos++; // skip '['
        skipWhitespace(s, pos);
        
        while (pos < s.length() && s[pos] != ']') {
            skipWhitespace(s, pos);
            if (s[pos] == ']') break;
            arr.arr.push_back(parseValue(s, pos));
            skipWhitespace(s, pos);
            if (s[pos] == ',') pos++;
        }
        if (pos < s.length() && s[pos] == ']') pos++;
        return arr;
    }
    
    static SimpleJson parseString(const std::string& s, size_t& pos) {
        SimpleJson str;
        str.type = STRING;
        pos++; // skip '"'
        std::stringstream ss;
        while (pos < s.length() && s[pos] != '"') {
            if (s[pos] == '\\\\' && pos + 1 < s.length()) {
                pos++;
                if (s[pos] == 'n') ss << '\\n';
                else if (s[pos] == 't') ss << '\\t';
                else if (s[pos] == 'r') ss << '\\r';
                else ss << s[pos];
            } else {
                ss << s[pos];
            }
            pos++;
        }
        if (pos < s.length() && s[pos] == '"') pos++;
        str.str = ss.str();
        return str;
    }
    
    static SimpleJson parseNumber(const std::string& s, size_t& pos) {
        SimpleJson num;
        num.type = NUMBER;
        size_t start = pos;
        if (s[pos] == '-') pos++;
        while (pos < s.length() && (std::isdigit(s[pos]) || s[pos] == '.')) pos++;
        num.num = std::stod(s.substr(start, pos - start));
        return num;
    }
    
    static SimpleJson parseBool(const std::string& s, size_t& pos) {
        SimpleJson b;
        b.type = BOOL;
        if (s.substr(pos, 4) == "true") {
            b.b = true;
            pos += 4;
        } else if (s.substr(pos, 5) == "false") {
            b.b = false;
            pos += 5;
        }
        return b;
    }
    
    static void skipWhitespace(const std::string& s, size_t& pos) {
        while (pos < s.length() && std::isspace(s[pos])) pos++;
    }
    
    SimpleJson& operator[](const std::string& key) {
        if (type == OBJECT) return obj[key];
        static SimpleJson null;
        return null;
    }
    
    SimpleJson& operator[](size_t idx) {
        if (type == ARRAY && idx < arr.size()) return arr[idx];
        static SimpleJson null;
        return null;
    }
    
    bool empty() const {
        if (type == OBJECT) return obj.empty();
        if (type == ARRAY) return arr.empty();
        return true;
    }
    
    std::string dump() const {
        if (type == OBJECT) {
            std::stringstream ss;
            ss << "{";
            bool first = true;
            for (const auto& [k, v] : obj) {
                if (!first) ss << ",";
                first = false;
                ss << "\\"" << escape(k) << "\\":" << v.dump();
            }
            ss << "}";
            return ss.str();
        }
        if (type == ARRAY) {
            std::stringstream ss;
            ss << "[";
            for (size_t i = 0; i < arr.size(); i++) {
                if (i > 0) ss << ",";
                ss << arr[i].dump();
            }
            ss << "]";
            return ss.str();
        }
        if (type == STRING) return "\\"" + escape(str) + "\\"";
        if (type == NUMBER) return std::to_string(num);
        if (type == BOOL) return b ? "true" : "false";
        return "null";
    }
    
    static std::string escape(const std::string& s) {
        std::stringstream ss;
        for (char c : s) {
            if (c == '"') ss << "\\\\\\"";
            else if (c == '\\\\') ss << "\\\\\\\\";
            else if (c == '\\n') ss << "\\\\n";
            else ss << c;
        }
        return ss.str();
    }
    
    std::map<std::string, SimpleJson>::iterator begin() { return obj.begin(); }
    std::map<std::string, SimpleJson>::iterator end() { return obj.end(); }
};

using json = SimpleJson;

// Function pointer type for implementation functions
// Note: Indicators are passed as json (SimpleJson) to support different structures
using ImplementationFn = std::map<std::string, int>(*)(
    std::map<std::string, std::vector<std::vector<double>>>,
    std::map<std::string, double>,
    const json&
);

// Forward declarations - will be defined in wrapped user algorithm files
${filenames
  .map((f) => {
    const baseName = f.replace(/\.cpp$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    return `extern std::map<std::string, int> implementation_${baseName}(
    std::map<std::string, std::vector<std::vector<double>>>,
    std::map<std::string, double>,
    const json&
);`;
  })
  .join('\n')}

std::vector<std::string> filenames = {${filenames.map((f) => `"${f}"`).join(', ')}};
std::vector<ImplementationFn> implementations = {${filenames
  .map((f) => {
    const baseName = f.replace(/\.cpp$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    return `implementation_${baseName}`;
  })
  .join(', ')}};
// Track which algorithms are simple (take std::vector<std::vector<double>> as first param)
std::vector<bool> isSimpleAlgorithm = {${filenames
  .map((f) => {
    if (!files?.[f]) {
      // Default to false (market algorithm) if file content not available
      return 'false';
    }
    const code = files[f];
    const hasSimpleSignature = /implementation\s*\(\s*std::vector<std::vector<double>>/.test(code);
    return hasSimpleSignature ? 'true' : 'false';
  })
  .join(', ')}};

// Helper to convert JSON to C++ types
std::map<std::string, std::vector<std::vector<double>>> jsonToContext(const json& j) {
    std::map<std::string, std::vector<std::vector<double>>> result;
    for (auto& [ticker, bars_json] : j.obj) {
        std::vector<std::vector<double>> bars;
        for (auto& bar_json : bars_json.arr) {
            std::vector<double> bar;
            for (auto& val_json : bar_json.arr) {
                bar.push_back(val_json.num);
            }
            bars.push_back(bar);
        }
        result[ticker] = bars;
    }
    return result;
}

std::map<std::string, double> jsonToPositions(const json& j) {
    std::map<std::string, double> result;
    for (auto& [ticker, pos_json] : j.obj) {
        result[ticker] = pos_json.num;
    }
    return result;
}

// Helper functions to convert json indicators to specific types
// These are used by wrapper functions generated in wrapCppUserCode

std::map<std::string, std::map<std::string, std::vector<double>>> jsonToIndicatorsVector(const json& j) {
    std::map<std::string, std::map<std::string, std::vector<double>>> result;
    for (auto& [ticker, indicators_json] : j.obj) {
        std::map<std::string, std::vector<double>> ticker_indicators;
        for (auto& [indicator_name, values_json] : indicators_json.obj) {
            std::vector<double> values;
            if (values_json.type == json::ARRAY) {
                for (auto& val_json : values_json.arr) {
                    if (val_json.type == json::NUMBER) {
                        values.push_back(val_json.num);
                    }
                }
            }
            ticker_indicators[indicator_name] = values;
        }
        result[ticker] = ticker_indicators;
    }
    return result;
}

std::map<std::string, std::map<std::string, std::map<std::string, double>>> jsonToIndicatorsObject(const json& j) {
    std::map<std::string, std::map<std::string, std::map<std::string, double>>> result;
    for (auto& [ticker, indicators_json] : j.obj) {
        std::map<std::string, std::map<std::string, double>> ticker_indicators;
        for (auto& [indicator_name, indicator_json] : indicators_json.obj) {
            std::map<std::string, double> indicator_obj;
            if (indicator_json.type == json::OBJECT) {
                for (auto& [key, value_json] : indicator_json.obj) {
                    if (value_json.type == json::NUMBER) {
                        indicator_obj[key] = value_json.num;
                    }
                }
            }
            ticker_indicators[indicator_name] = indicator_obj;
        }
        result[ticker] = ticker_indicators;
    }
    return result;
}

std::map<std::string, std::map<std::string, std::vector<std::map<std::string, int>>>> jsonToIndicatorsVectorOfObjects(const json& j) {
    std::map<std::string, std::map<std::string, std::vector<std::map<std::string, int>>>> result;
    for (auto& [ticker, indicators_json] : j.obj) {
        std::map<std::string, std::vector<std::map<std::string, int>>> ticker_indicators;
        for (auto& [indicator_name, indicator_json] : indicators_json.obj) {
            std::vector<std::map<std::string, int>> indicator_array;
            if (indicator_json.type == json::ARRAY) {
                for (auto& item_json : indicator_json.arr) {
                    std::map<std::string, int> item_obj;
                    if (item_json.type == json::OBJECT) {
                        for (auto& [key, value_json] : item_json.obj) {
                            if (value_json.type == json::NUMBER) {
                                item_obj[key] = static_cast<int>(value_json.num);
                            } else if (value_json.type == json::BOOL) {
                                item_obj[key] = value_json.b ? 1 : 0;
                            }
                        }
                    }
                    indicator_array.push_back(item_obj);
                }
            }
            ticker_indicators[indicator_name] = indicator_array;
        }
        result[ticker] = ticker_indicators;
    }
    return result;
}

// Helper to convert C++ result to JSON
// For simple algorithms (map with single entry), return just the action value
// For market algorithms, always return the full object (even if single entry)
json resultToJson(const std::map<std::string, int>& result, bool isSimple) {
    // If result is empty, return appropriate default
    if (result.empty()) {
        if (isSimple) {
            // Simple algorithm: return HOLD action
            json j;
            j.type = json::NUMBER;
            j.num = 2.0; // HOLD action
            j.b = false;
            j.str = "";
            j.obj.clear();
            j.arr.clear();
            return j;
        } else {
            // Market algorithm: return empty object
            json j;
            j.type = json::OBJECT;
            return j;
        }
    }
    // For simple algorithms with single entry, return just the action value (number)
    if (isSimple && result.size() == 1) {
        json j;
        j.type = json::NUMBER;
        j.num = static_cast<double>(result.begin()->second);
        j.b = false;
        j.str = "";
        j.obj.clear();
        j.arr.clear();
        return j;
    }
    // For market algorithms (or simple algorithms with multiple entries), return as object
    json j;
    j.type = json::OBJECT;
    for (auto& [ticker, action] : result) {
        j.obj[ticker] = json();
        j.obj[ticker].type = json::NUMBER;
        j.obj[ticker].num = static_cast<double>(action);
        j.obj[ticker].obj.clear();
        j.obj[ticker].arr.clear();
        j.obj[ticker].str.clear();
        j.obj[ticker].b = false;
    }
    return j;
}

int main() {
    std::cout << "compiled" << std::endl;
    std::cout.flush();
    
    std::string line;
    while (std::getline(std::cin, line)) {
        try {
            json msg = json::parse(line);
            json params_by_index = msg["args"][0];
            
            if (params_by_index.empty()) {
                json result;
                result.type = json::OBJECT;
                json response;
                response.type = json::OBJECT;
                response.obj["ok"] = json();
                response.obj["ok"].type = json::BOOL;
                response.obj["ok"].b = true;
                response.obj["result"] = result;
                std::cout << response.dump() << std::endl;
                std::cout.flush();
                continue;
            }
            
            json result_by_index;
            result_by_index.type = json::OBJECT;
            std::vector<std::future<json>> futures;
            std::vector<std::string> indices;
            
            for (auto& [index_str, params] : params_by_index.obj) {
                int index = std::stoi(index_str);
                if (index < 0 || index >= static_cast<int>(implementations.size())) {
                    throw std::runtime_error("Invalid algorithm index: " + index_str);
                }
                
                indices.push_back(index_str);
                json params_copy = params;
                
                futures.push_back(std::async(std::launch::async, [index, params_copy]() {
                    try {
                        json context_json = params_copy.arr[0];
                        json positions_json = params_copy.arr[1];
                        json indicators_json = params_copy.arr[2];
                        
                        auto context = jsonToContext(context_json);
                        auto positions = jsonToPositions(positions_json);
                        // Pass indicators as json directly - wrapper functions will convert to expected types
                        
                        auto result = implementations[index](context, positions, indicators_json);
                        // Ensure index is within bounds for isSimpleAlgorithm
                        bool isSimple = (index >= 0 && index < static_cast<int>(isSimpleAlgorithm.size())) 
                            ? isSimpleAlgorithm[index] 
                            : false;
                        return resultToJson(result, isSimple);
                    } catch (const std::exception& e) {
                        // Return error as json object
                        json error_json;
                        error_json.type = json::OBJECT;
                        error_json.obj["error"] = json();
                        error_json.obj["error"].type = json::STRING;
                        error_json.obj["error"].str = e.what();
                        return error_json;
                    }
                }));
            }
            
            // Process all futures and populate result_by_index
            for (size_t i = 0; i < futures.size(); ++i) {
                json result_json;
                try {
                    result_json = futures[i].get();
                } catch (const std::exception& e) {
                    // If future.get() throws, create error response
                    result_json = json();
                    result_json.type = json::OBJECT;
                    result_json.obj["error"] = json();
                    result_json.obj["error"].type = json::STRING;
                    result_json.obj["error"].str = e.what();
                }
                
                // Create a new json object and copy all fields explicitly
                // This ensures NUMBER type and all other types are preserved
                json new_entry;
                new_entry.type = result_json.type;
                new_entry.num = result_json.num;
                new_entry.str = result_json.str;
                new_entry.b = result_json.b;
                new_entry.obj = result_json.obj;
                new_entry.arr = result_json.arr;
                
                // Assign using operator[] - this should work correctly
                result_by_index.obj[indices[i]] = new_entry;
            }
            
            // Ensure result_by_index is properly set as OBJECT type
            result_by_index.type = json::OBJECT;
            
            json response;
            response.type = json::OBJECT;
            response.obj["ok"] = json();
            response.obj["ok"].type = json::BOOL;
            response.obj["ok"].b = true;
            response.obj["result"] = result_by_index;
            std::cout << response.dump() << std::endl;
            std::cout.flush();
        } catch (const std::exception& e) {
            json error_response;
            error_response.type = json::OBJECT;
            error_response.obj["ok"] = json();
            error_response.obj["ok"].type = json::BOOL;
            error_response.obj["ok"].b = false;
            error_response.obj["error"] = json();
            error_response.obj["error"].type = json::STRING;
            error_response.obj["error"].str = e.what();
            std::cout << error_response.dump() << std::endl;
            std::cout.flush();
        }
    }
    return 0;
}
`;

export const UTILS_CPP_CODE = `
#include "utils.hpp"
#include <ctime>

const std::vector<std::string> DAYS_OF_WEEK = {
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
};

std::string day_of_week(long long timestamp) {
    std::time_t time = timestamp / 1000;
    std::tm* date = std::localtime(&time);
    return DAYS_OF_WEEK[date->tm_wday];
}
`;

export const UTILS_CPP_HEADER = `
#ifndef UTILS_HPP
#define UTILS_HPP

#include <string>
#include <vector>

enum Action {
    BUY = 0,
    SELL = 1,
    HOLD = 2
};

enum Direction {
    UP = 0,
    DOWN = 1
};

extern const std::vector<std::string> DAYS_OF_WEEK;

std::string day_of_week(long long timestamp);

#endif
`;

export function wrapCppUserCode(filename: string, code: string): string {
  const baseName = filename.replace(/\.cpp$/, '').replace(/[^a-zA-Z0-9]/g, '_');

  // Detect function signature
  const hasSimpleSignature = /implementation\s*\(\s*std::vector<std::vector<double>>/.test(code);
  const returnsInt = /\bint\s+implementation\s*\(/.test(code);

  // Detect indicator signature type
  // Match: std::map<std::string, std::map<std::string, std::map<std::string, double>>>
  const hasObjectIndicators =
    /std::map\s*<\s*std::string\s*,\s*std::map\s*<\s*std::string\s*,\s*std::map\s*<\s*std::string\s*,\s*double\s*>\s*>\s*>/.test(
      code,
    );
  const hasVectorOfObjectsIndicators =
    /std::map<std::string,\s*std::map<std::string,\s*std::vector<std::map<std::string,\s*int>>>>/.test(
      code,
    );

  let wrappedCode = code;

  // Create wrapper function with market signature
  if (hasSimpleSignature && returnsInt) {
    // Simple algorithm returning int - rename to _impl and create wrapper
    wrappedCode = wrappedCode.replace(
      /\bint\s+implementation\s*\(/g,
      `int implementation_${baseName}_impl(`,
    );
    // Ensure <map> is included for wrapper
    if (!code.includes('#include <map>')) {
      wrappedCode = wrappedCode.replace(
        /#include "utils.hpp"/,
        `#include "utils.hpp"\n#include <map>`,
      );
    }
    wrappedCode += `\n\n// Forward declaration for json type (defined in runner.cpp)
class SimpleJson;
using json = SimpleJson;

// Wrapper to normalize signature
std::map<std::string, int> implementation_${baseName}(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    const json& _indicators_json
) {
    if (context.empty()) {
        std::map<std::string, int> result;
        return result;
    }
    std::vector<std::vector<double>> firstContext = context.begin()->second;
    int action = implementation_${baseName}_impl(firstContext);
    std::map<std::string, int> result;
    result[context.begin()->first] = action;
    return result;
}`;
  } else if (hasSimpleSignature) {
    // Simple algorithm returning map - rename to _impl and create wrapper
    wrappedCode = wrappedCode.replace(
      /std::map<std::string,\s*int>\s+implementation\s*\(/g,
      `std::map<std::string, int> implementation_${baseName}_impl(`,
    );
    // Ensure <map> is included (should already be, but check)
    if (!code.includes('#include <map>')) {
      wrappedCode = wrappedCode.replace(
        /#include "utils.hpp"/,
        `#include "utils.hpp"\n#include <map>`,
      );
    }
    wrappedCode += `\n\n// Forward declaration for json type (defined in runner.cpp)
class SimpleJson;
using json = SimpleJson;

// Wrapper to normalize signature
std::map<std::string, int> implementation_${baseName}(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    const json& _indicators_json
) {
    if (context.empty()) {
        std::map<std::string, int> result;
        return result;
    }
    std::vector<std::vector<double>> firstContext = context.begin()->second;
    return implementation_${baseName}_impl(firstContext);
}`;
  } else {
    // Market algorithm - rename to _impl and create wrapper with json indicators
    // First, rename the original function
    wrappedCode = wrappedCode.replace(
      /std::map\s*<\s*std::string\s*,\s*int\s*>\s+implementation\s*\(/g,
      `std::map<std::string, int> implementation_${baseName}_impl(`,
    );
    wrappedCode = wrappedCode.replace(
      /(std::map\s*<\s*std::string\s*,\s*int\s*>)\s*\n\s*implementation\s*\(/g,
      `$1 implementation_${baseName}_impl(`,
    );

    // Determine which conversion function to use based on indicator signature
    let indicatorConversion = 'jsonToIndicatorsVector';
    let indicatorType = 'std::map<std::string, std::map<std::string, std::vector<double>>>';

    if (hasObjectIndicators) {
      indicatorConversion = 'jsonToIndicatorsObject';
      indicatorType = 'std::map<std::string, std::map<std::string, std::map<std::string, double>>>';
    } else if (hasVectorOfObjectsIndicators) {
      indicatorConversion = 'jsonToIndicatorsVectorOfObjects';
      indicatorType =
        'std::map<std::string, std::map<std::string, std::vector<std::map<std::string, int>>>>';
    }

    // Generate wrapper function that converts json to expected indicator type
    wrappedCode += `\n\n// Forward declaration for json type and conversion functions (defined in runner.cpp)
class SimpleJson;
using json = SimpleJson;
extern std::map<std::string, std::map<std::string, std::vector<double>>> jsonToIndicatorsVector(const json&);
extern std::map<std::string, std::map<std::string, std::map<std::string, double>>> jsonToIndicatorsObject(const json&);
extern std::map<std::string, std::map<std::string, std::vector<std::map<std::string, int>>>> jsonToIndicatorsVectorOfObjects(const json&);

// Wrapper to convert json indicators to expected type
std::map<std::string, int> implementation_${baseName}(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> positions,
    const json& indicators_json
) {
    ${indicatorType} indicators = ${indicatorConversion}(indicators_json);
    return implementation_${baseName}_impl(context, positions, indicators);
}`;
  }

  return wrappedCode;
}
