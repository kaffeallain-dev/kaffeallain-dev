import React, { useState } from 'react';
import { ChevronRight, RefreshCcw, Edit2, AlertCircle, CheckCircle, Plus } from 'lucide-react';
import { FoodRecognitionResult, RecognizedItemDetails } from '../features/vision/domain/pipeline/FoodRecognitionPipelineTypes';
import { motion } from 'motion/react';
import { commonFoods as foodDatabase } from '../data/foodDatabase';

interface Props {
  result: FoodRecognitionResult;
  onConfirm: (result: FoodRecognitionResult) => void;
  onRetake: () => void;
  onManualAdd?: () => void;
}

export function ResultsScreen({ result, onConfirm, onRetake, onManualAdd }: Props) {
  const [items, setItems] = useState<RecognizedItemDetails[]>(result.items);

  const handleWeightChange = (index: number, newWeight: string) => {
    const parsed = parseInt(newWeight, 10);
    if (isNaN(parsed)) return;
    
    const updated = [...items];
    updated[index].estimatedPortion.estimatedWeight = parsed;
    setItems(updated);
  };

  const handleCandidateSelection = (index: number, foodKnowledgeId: string) => {
    const updated = [...items];
    const item = updated[index];
    const knowledge = foodDatabase.find(f => f.id === foodKnowledgeId);
    
    if (knowledge) {
      const mappedKnowledge: any = {
        id: knowledge.id,
        name: knowledge.name,
        aliases: knowledge.aliases || [],
        searchKeywords: [],
        category: knowledge.category || 'Other',
        mealType: ['Lunch', 'Dinner'],
        country: 'Cameroon',
        regions: [],
        servingSizes: { medium: knowledge.servingSizeText || '1 serving' },
        nutrition: {
          calories: knowledge.calories,
          protein: knowledge.protein,
          carbohydrates: knowledge.carbs,
          fat: knowledge.fat,
          fiber: knowledge.fiber || 0,
          sugar: knowledge.sugar || 0,
          sodium: knowledge.sodium || 0,
        },
        foodIntelligence: { concerns: knowledge.concerns || [] },
        goalCompatibility: {},
        scores: { healthScore: 7, satietyScore: 7 },
        foodRelationships: { betterAlternatives: knowledge.alternatives || [] },
        aiCoaching: []
      };
      
      item.foodKnowledge = mappedKnowledge;
      item.nutritionStatus = "matched";
      item.match.foodKnowledgeId = foodKnowledgeId;
      item.match.matchedName = knowledge.name;
    }
    setItems(updated);
  };

  const handleConfirm = () => {
    onConfirm({ ...result, items });
  };

  const hasLowQuality = result.imageQuality === "LOW";
  const hasNoItems = items.length === 0;
  const confirmedCount = items.filter(i => i.nutritionStatus === "matched").length;
  const canProceed = confirmedCount > 0;

  return (
    <div className="absolute inset-0 bg-white z-40 flex flex-col h-full">
      {/* Header Image */}
      <div className="relative h-[40%] rounded-b-[40px] overflow-hidden shadow-sm shrink-0">
        <img src={result.image.image} alt="Captured meal" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6">
          <h2 className="text-white text-2xl font-bold">Detected Foods</h2>
          <p className="text-white/80 text-sm">{items.length} items found</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {hasLowQuality && (
           <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start space-x-3 mb-4">
              <AlertCircle size={24} className="text-amber-500 shrink-0" />
              <div>
                 <h4 className="font-semibold text-amber-800">Poor Image Quality</h4>
                 <p className="text-sm text-amber-700">The image is too blurry, dark, or no food is visible. Please retake the photo for better results.</p>
              </div>
           </div>
        )}

        {items.map((item, idx) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={item.detectionId || idx} 
            className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex flex-col space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-gray-800 text-lg capitalize">{item.detectedLabel}</h3>
                </div>
                
                <div className="mt-1 mb-2 flex flex-col space-y-1">
                  <p className="text-xs text-gray-500">
                    Detection: {item.detectionConfidence !== undefined 
                      ? (item.detectionConfidence > 0.8 ? "High confidence" : item.detectionConfidence > 0.5 ? "Medium confidence" : "Low confidence") 
                      : "Unknown confidence"}
                  </p>
                  
                  <div className="flex items-center space-x-1">
                    {item.nutritionStatus === "needs_confirmation" ? (
                      <>
                        <AlertCircle size={14} className="text-amber-500" />
                        <span className="text-xs font-medium text-amber-600">
                          {item.match.decision === 'AMBIGUOUS' ? 'Multiple matches' : 
                           item.match.decision === 'UNKNOWN' ? 'Not recognized' : 'Needs confirmation'}
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-600">
                          Matched: {item.foodKnowledge?.name}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-sm text-gray-500 capitalize">{item.estimatedPortion.portionDescription}</p>
              </div>
              
              <div className="flex items-center space-x-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                <input 
                  type="number" 
                  value={item.estimatedPortion.estimatedWeight}
                  onChange={(e) => handleWeightChange(idx, e.target.value)}
                  className="w-12 bg-transparent text-right font-semibold text-emerald-600 focus:outline-none"
                />
                <span className="text-gray-500 font-medium text-sm">g</span>
                <Edit2 size={14} className="text-gray-400 ml-1" />
              </div>
            </div>

            {item.nutritionStatus === "needs_confirmation" && (
              <div className="pt-2 border-t border-gray-100">
                {item.match.decision === 'UNKNOWN' ? (
                  <p className="text-xs text-amber-600 font-medium mb-2">
                    Food not recognized. Use 'Add missing food' below.
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-amber-600 font-medium mb-2">
                      {item.match.decision === 'AMBIGUOUS' 
                        ? 'Multiple matches found. Please select one:' 
                        : 'Possible match. Please confirm:'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {item.match.fallbackSuggestions.map((suggestion) => (
                        <button 
                          key={suggestion.foodKnowledgeId}
                          onClick={() => handleCandidateSelection(idx, suggestion.foodKnowledgeId)}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-xs font-semibold text-gray-700 transition-colors"
                        >
                          {suggestion.name}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </motion.div>
        ))}

        {hasNoItems && !hasLowQuality && (
          <div className="text-center py-10">
            <AlertCircle size={40} className="mx-auto text-gray-300 mb-3" />
            <h3 className="text-gray-500 font-medium">Some foods couldn't be identified.</h3>
            <p className="text-sm text-gray-400 mt-2">Try taking a clearer photo or adding the food manually.</p>
          </div>
        )}
        
        {/* Add Missing Food Button */}
        <div className="pt-4 flex justify-center">
          <button 
            onClick={onManualAdd}
            className="flex items-center text-emerald-600 font-medium text-sm hover:text-emerald-700 transition-colors bg-emerald-50 px-4 py-2 rounded-full"
          >
            <Plus size={16} className="mr-1" />
            Add missing food
          </button>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="p-6 pb-12 bg-white border-t border-gray-100 flex flex-col space-y-4 shrink-0">
        {!canProceed && !hasNoItems && !hasLowQuality && (
          <p className="text-center text-amber-600 text-sm font-medium">
            Please confirm at least one food to continue.
          </p>
        )}
        <div className="flex space-x-4">
          <button 
            onClick={onRetake}
            className="flex-1 py-4 rounded-full border-2 border-gray-200 text-gray-600 font-semibold flex justify-center items-center"
          >
            <RefreshCcw size={20} className="mr-2" />
            Retake
          </button>
          <button 
            onClick={handleConfirm}
            disabled={!canProceed}
            className="flex-1 py-4 rounded-full bg-emerald-600 text-white font-semibold flex justify-center items-center shadow-lg shadow-emerald-600/30 disabled:bg-gray-300 disabled:text-gray-500 disabled:shadow-none transition-colors"
          >
            View Analysis
            <ChevronRight size={20} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
