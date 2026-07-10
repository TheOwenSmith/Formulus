export const RUNNER_CPP_BATCHED_FROM_FILENAMES = (
  filenames: string[],
  files?: Record<string, string>,
) => `
#include <iostream>
#include <string>
#include <vector>
#include <map>
#include <future>
#include <stdexcept>
#include <sstream>
#include <iomanip>
#include <ctime>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Bar tuples are [timestamp, open, high, low, close, volume].
// Timestamp is an ISO string in RPC JSON; C++ algorithms expect epoch milliseconds as double.
double parseTimestampStringToEpochMs(const std::string& timestamp) {
    std::tm tm = {};
    std::istringstream ss(timestamp);

    ss >> std::get_time(&tm, "%Y-%m-%d %H:%M:%S");
    if (!ss.fail()) {
        tm.tm_isdst = -1;
        time_t time = mktime(&tm);
        if (time == -1) {
            throw std::runtime_error("Invalid timestamp: " + timestamp);
        }
        return static_cast<double>(time) * 1000.0;
    }

    ss.clear();
    ss.str(timestamp);
    ss >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
    if (!ss.fail()) {
        tm.tm_isdst = -1;
        time_t time = mktime(&tm);
        if (time == -1) {
            throw std::runtime_error("Invalid timestamp: " + timestamp);
        }
        return static_cast<double>(time) * 1000.0;
    }

    throw std::runtime_error("Unsupported timestamp format: " + timestamp);
}

double jsonBarValueToDouble(const json& val_json, bool is_timestamp) {
    if (val_json.is_number()) {
        return val_json.get<double>();
    }
    if (val_json.is_string()) {
        if (is_timestamp) {
            return parseTimestampStringToEpochMs(val_json.get<std::string>());
        }
        return std::stod(val_json.get<std::string>());
    }
    throw std::runtime_error("Bar value must be a number or string");
}

// Function pointer type for implementation functions
// Wrappers return JSON directly so action and score results are both supported
using ImplementationFn = json(*)(
    std::map<std::string, std::vector<std::vector<double>>>,
    std::map<std::string, double>,
    const json&
);

// Forward declarations - will be defined in wrapped user algorithm files
${filenames
  .map((f) => {
    const baseName = f.replace(/\.cpp$/, '').replace(/[^a-zA-Z0-9]/g, '_');
    return `extern json implementation_${baseName}(
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

std::vector<std::vector<double>> jsonBarArrayToVector(const json& j) {
    if (!j.is_array()) {
        throw std::runtime_error("Expected bar array for simple algorithm context");
    }
    std::vector<std::vector<double>> bars;
    for (const auto& bar_json : j) {
        if (!bar_json.is_array()) {
            throw std::runtime_error("Expected each bar to be an array");
        }
        std::vector<double> bar;
        for (size_t i = 0; i < bar_json.size(); ++i) {
            bar.push_back(jsonBarValueToDouble(bar_json.at(i), i == 0));
        }
        bars.push_back(bar);
    }
    return bars;
}

std::map<std::string, std::vector<std::vector<double>>> wrapSimpleContext(const json& j) {
    return {{"_", jsonBarArrayToVector(j)}};
}

std::vector<double> jsonBarTupleToVector(const json& bar_json) {
    if (!bar_json.is_array()) {
        throw std::runtime_error("Expected bar tuple to be an array");
    }
    std::vector<double> bar;
    for (size_t i = 0; i < bar_json.size(); ++i) {
        bar.push_back(jsonBarValueToDouble(bar_json.at(i), i == 0));
    }
    return bar;
}

std::map<std::string, std::vector<std::vector<double>>> jsonToContext(const json& j) {
    if (!j.is_object()) {
        throw std::runtime_error("Expected ticker-keyed context object for market algorithm");
    }
    std::map<std::string, std::vector<std::vector<double>>> result;
    for (auto& [ticker, bars_json] : j.items()) {
        if (!bars_json.is_array()) {
            throw std::runtime_error("Expected bars for ticker '" + ticker + "' to be an array");
        }
        std::vector<std::vector<double>> bars;
        for (const auto& bar_json : bars_json) {
            bars.push_back(jsonBarTupleToVector(bar_json));
        }
        result[ticker] = bars;
    }
    return result;
}

std::map<std::string, double> jsonToPositions(const json& j) {
    if (!j.is_object()) {
        throw std::runtime_error("Expected ticker-keyed positions object for market algorithm");
    }
    std::map<std::string, double> result;
    for (auto& [ticker, pos_json] : j.items()) {
        result[ticker] = pos_json.get<double>();
    }
    return result;
}

// Helper functions to convert json indicators to specific types
// These are used by wrapper functions generated in wrapCppUserCode

std::map<std::string, std::map<std::string, std::vector<double>>> jsonToIndicatorsVector(const json& j) {
    std::map<std::string, std::map<std::string, std::vector<double>>> result;
    for (auto& [ticker, indicators_json] : j.items()) {
        std::map<std::string, std::vector<double>> ticker_indicators;
        for (auto& [indicator_name, values_json] : indicators_json.items()) {
            std::vector<double> values;
            if (values_json.is_array()) {
                for (const auto& val_json : values_json) {
                    if (val_json.is_number()) {
                        values.push_back(val_json.get<double>());
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
    for (auto& [ticker, indicators_json] : j.items()) {
        std::map<std::string, std::map<std::string, double>> ticker_indicators;
        for (auto& [indicator_name, indicator_json] : indicators_json.items()) {
            std::map<std::string, double> indicator_obj;
            if (indicator_json.is_object()) {
                for (auto& [key, value_json] : indicator_json.items()) {
                    if (value_json.is_number()) {
                        indicator_obj[key] = value_json.get<double>();
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
    for (auto& [ticker, indicators_json] : j.items()) {
        std::map<std::string, std::vector<std::map<std::string, int>>> ticker_indicators;
        for (auto& [indicator_name, indicator_json] : indicators_json.items()) {
            std::vector<std::map<std::string, int>> indicator_array;
            if (indicator_json.is_array()) {
                for (const auto& item_json : indicator_json) {
                    std::map<std::string, int> item_obj;
                    if (item_json.is_object()) {
                        for (auto& [key, value_json] : item_json.items()) {
                            if (value_json.is_number()) {
                                item_obj[key] = static_cast<int>(value_json.get<double>());
                            } else if (value_json.is_boolean()) {
                                item_obj[key] = value_json.get<bool>() ? 1 : 0;
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

// Convert action maps to RPC JSON. Simple algorithms return a bare action value.
json actionMapToJson(const std::map<std::string, int>& result, bool flattenSingleEntry) {
    if (result.empty()) {
        return flattenSingleEntry ? json(2) : json::object();
    }
    if (flattenSingleEntry && result.size() == 1) {
        return result.begin()->second;
    }
    json j = json::object();
    for (const auto& [ticker, action] : result) {
        j[ticker] = action;
    }
    return j;
}

json scoreMapToJson(const std::map<std::string, double>& scores) {
    json j = json::object();
    for (const auto& [ticker, score] : scores) {
        j[ticker] = score;
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
                json response = {{"ok", true}, {"result", json::object()}};
                std::cout << response.dump() << std::endl;
                std::cout.flush();
                continue;
            }

            json result_by_index = json::object();
            std::vector<std::future<json>> futures;
            std::vector<std::string> indices;

            for (auto& [index_str, params] : params_by_index.items()) {
                int index = std::stoi(index_str);
                if (index < 0 || index >= static_cast<int>(implementations.size())) {
                    throw std::runtime_error("Invalid algorithm index: " + index_str);
                }

                indices.push_back(index_str);
                json params_copy = params;

                futures.push_back(std::async(std::launch::async, [index, params_copy]() {
                    if (!params_copy.is_array() || params_copy.size() < 3) {
                        throw std::runtime_error("Expected 3 RPC parameters [context, positions, indicators]");
                    }

                    json context_json = params_copy.at(0);
                    json positions_json = params_copy.at(1);
                    json indicators_json = params_copy.at(2);

                    bool isSimple = (index >= 0 && index < static_cast<int>(isSimpleAlgorithm.size()))
                        ? isSimpleAlgorithm[index]
                        : false;

                    std::map<std::string, std::vector<std::vector<double>>> context;
                    std::map<std::string, double> positions;

                    // Simple algorithms receive Bar[]; market algorithms receive Record<Ticker, Bar[]>
                    if (isSimple || context_json.is_array()) {
                        context = wrapSimpleContext(context_json);
                        positions = {};
                    } else {
                        context = jsonToContext(context_json);
                        positions = jsonToPositions(positions_json);
                    }

                    auto result = implementations[index](context, positions, indicators_json);
                    return result;
                }));
            }

            for (size_t i = 0; i < futures.size(); ++i) {
                result_by_index[indices[i]] = futures[i].get();
            }

            json response = {{"ok", true}, {"result", result_by_index}};
            std::cout << response.dump() << std::endl;
            std::cout.flush();
        } catch (const std::exception& e) {
            json error_response = {{"ok", false}, {"error", e.what()}};
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
  const returnsScoreMap =
    /std::map\s*<\s*std::string\s*,\s*double\s*>[\s\S]{0,80}?\bimplementation\s*\(/.test(code);

  const renameMarketImplementation = (source: string): string => {
    const byReturnTypeOnSameLine = source.replace(
      /std::map\s*<\s*std::string\s*,\s*(?:int|double)\s*>\s+implementation(?!_)\s*\(/g,
      (match) => match.replace(/\bimplementation(?!_)\s*\(/, `implementation_${baseName}_impl(`),
    );
    return byReturnTypeOnSameLine.replace(
      /\bimplementation(?!_)\s*\(\s*std::map\s*<\s*std::string\s*,\s*std::vector\s*<\s*std::vector\s*<\s*double\s*>\s*>\s*>/g,
      `implementation_${baseName}_impl(std::map<std::string, std::vector<std::vector<double>>>`,
    );
  };

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

  if (wrappedCode.includes(`json implementation_${baseName}(`)) {
    return wrappedCode;
  }

  const jsonInclude = `#include <nlohmann/json.hpp>
using json = nlohmann::json;`;

  const indicatorConversion = hasObjectIndicators
    ? 'jsonToIndicatorsObject'
    : hasVectorOfObjectsIndicators
      ? 'jsonToIndicatorsVectorOfObjects'
      : 'jsonToIndicatorsVector';
  const indicatorType = hasObjectIndicators
    ? 'std::map<std::string, std::map<std::string, std::map<std::string, double>>>'
    : hasVectorOfObjectsIndicators
      ? 'std::map<std::string, std::map<std::string, std::vector<std::map<std::string, int>>>>'
      : 'std::map<std::string, std::map<std::string, std::vector<double>>>';

  const indicatorExternDecl = `extern std::map<std::string, std::map<std::string, std::vector<double>>> jsonToIndicatorsVector(const json&);
extern std::map<std::string, std::map<std::string, std::map<std::string, double>>> jsonToIndicatorsObject(const json&);
extern std::map<std::string, std::map<std::string, std::vector<std::map<std::string, int>>>> jsonToIndicatorsVectorOfObjects(const json&);`;

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
    wrappedCode += `\n\n${jsonInclude}

// Wrapper to normalize signature
json implementation_${baseName}(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    const json& _indicators_json
) {
    if (context.empty()) {
        return json(2);
    }
    std::vector<std::vector<double>> firstContext = context.begin()->second;
    return json(implementation_${baseName}_impl(firstContext));
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
    wrappedCode += `\n\n${jsonInclude}
extern json actionMapToJson(const std::map<std::string, int>&, bool);

// Wrapper to normalize signature
json implementation_${baseName}(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> _positions,
    const json& _indicators_json
) {
    if (context.empty()) {
        return json(2);
    }
    std::vector<std::vector<double>> firstContext = context.begin()->second;
    return actionMapToJson(implementation_${baseName}_impl(firstContext), true);
}`;
  } else if (returnsScoreMap) {
    // Top-K algorithm returning score map
    wrappedCode = renameMarketImplementation(wrappedCode);
    wrappedCode += `\n\n${jsonInclude}
${indicatorExternDecl}
extern json scoreMapToJson(const std::map<std::string, double>&);

// Wrapper to convert json indicators to expected type
json implementation_${baseName}(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> positions,
    const json& indicators_json
) {
    ${indicatorType} indicators = ${indicatorConversion}(indicators_json);
    return scoreMapToJson(implementation_${baseName}_impl(context, positions, indicators));
}`;
  } else {
    // Market algorithm - rename to _impl and create wrapper with json indicators
    wrappedCode = renameMarketImplementation(wrappedCode);

    // Generate wrapper function that converts json to expected indicator type
    wrappedCode += `\n\n${jsonInclude}
${indicatorExternDecl}
extern json actionMapToJson(const std::map<std::string, int>&, bool);

// Wrapper to convert json indicators to expected type
json implementation_${baseName}(
    std::map<std::string, std::vector<std::vector<double>>> context,
    std::map<std::string, double> positions,
    const json& indicators_json
) {
    ${indicatorType} indicators = ${indicatorConversion}(indicators_json);
    return actionMapToJson(implementation_${baseName}_impl(context, positions, indicators), false);
}`;
  }

  return wrappedCode;
}
