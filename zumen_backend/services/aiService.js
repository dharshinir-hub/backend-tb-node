/**
 * Zumen AI Service
 * Handles auto-generation of instructions, specifications, and reports
 */

class ZumenAIService {
  /**
   * Generate work instructions based on drawing/part details
   */
  static generateInstructions(drawingData) {
    const { drawingName, material, partNumber, projectId, complexity = 'Medium' } = drawingData;

    // AI generates steps based on part complexity and material
    const stepsMap = {
      'Simple': [
        '1. Prepare material according to specifications',
        '2. Cut to specified dimensions',
        '3. Quality check',
        '4. Package'
      ],
      'Medium': [
        '1. Prepare material according to specifications',
        '2. Cut blank to size',
        '3. Machine primary features',
        '4. Machine secondary features',
        '5. Apply surface finish',
        '6. Deburr and inspect edges',
        '7. Quality check all dimensions',
        '8. Final surface treatment if needed',
        '9. Package and label'
      ],
      'Complex': [
        '1. Prepare material and verify specifications',
        '2. Cut blank to approximate size',
        '3. Machine primary features with precision',
        '4. Machine secondary features',
        '5. Drill and tap holes to specification',
        '6. Apply initial surface treatment',
        '7. Heat treat if required',
        '8. Final surface finish (grinding/polishing)',
        '9. Apply protective coating',
        '10. Deburr all edges and corners',
        '11. Quality control inspection',
        '12. Dimensional verification',
        '13. Surface roughness check',
        '14. Final packaging and documentation'
      ]
    };

    const timeMap = { 'Simple': '15 minutes', 'Medium': '45 minutes', 'Complex': '120 minutes' };

    const instruction = {
      id: Math.floor(Math.random() * 10000),
      title: `${drawingName} - Manufacturing Instructions`,
      partNumber: partNumber,
      material: material,
      projectId: projectId,
      steps: stepsMap[complexity] || stepsMap['Medium'],
      estimatedTime: timeMap[complexity],
      difficulty: complexity,
      components: this._generateComponents(material),
      toolsRequired: this._generateTools(complexity),
      safetyPrecautions: this._generateSafetyPrecautions(material),
      createdDate: new Date().toISOString().split('T')[0],
      status: 'Draft',
      generatedByAI: true,
      aiVersion: '1.0'
    };

    return instruction;
  }

  /**
   * Generate specifications based on drawing dimensions and material
   */
  static generateSpecifications(drawingData) {
    const { drawingName, material, partNumber, projectId, dimensions = {} } = drawingData;

    // AI extracts or generates specifications
    const materialSpecs = this._getMaterialSpecifications(material);

    const specification = {
      id: Math.floor(Math.random() * 10000),
      partNumber: partNumber,
      partName: drawingName,
      material: material,
      projectId: projectId,
      specs: {
        ...dimensions, // Add extracted dimensions
        ...materialSpecs, // Add material properties
        ...this._getDefaultTolerances(material)
      },
      status: 'Active',
      createdDate: new Date().toISOString().split('T')[0],
      generatedByAI: true,
      aiVersion: '1.0',
      notes: `Auto-generated specifications for ${drawingName}. Review and edit as needed.`
    };

    return specification;
  }

  /**
   * Generate inspection report template
   */
  static generateInspectionTemplate(drawingData, specifications) {
    const { drawingName, partNumber, projectId } = drawingData;

    // AI creates inspection items based on specifications
    const inspectionItems = this._createInspectionItems(specifications.specs);

    const reportTemplate = {
      id: Math.floor(Math.random() * 10000),
      partNumber: partNumber,
      partName: drawingName,
      projectId: projectId,
      type: 'InspectionTemplate',
      status: 'Template Ready',
      createdDate: new Date().toISOString().split('T')[0],
      inspectionItems: inspectionItems,
      passCriteria: {
        minPassScore: 80, // 80% of checks must pass
        criticalItems: this._identifyCriticalItems(inspectionItems),
        allowableDefects: this._getAllowableDefects(specifications)
      },
      generatedByAI: true,
      aiVersion: '1.0',
      notes: `Template auto-generated for ${drawingName}. Configure before first use.`
    };

    return reportTemplate;
  }

  /**
   * Main function to generate all documents
   */
  static generateAllDocuments(drawingData) {
    try {
      // Generate in order: specs first (others depend on it)
      const specifications = this.generateSpecifications(drawingData);
      const instructions = this.generateInstructions(drawingData);
      const reportTemplate = this.generateInspectionTemplate(drawingData, specifications);

      return {
        success: true,
        instructions,
        specifications,
        reportTemplate,
        generatedAt: new Date().toISOString(),
        summary: {
          instructionSteps: instructions.steps.length,
          specificationCount: Object.keys(specifications.specs).length,
          inspectionItems: reportTemplate.inspectionItems.length
        }
      };
    } catch (error) {
      console.error('AI Generation Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // ==================== HELPER METHODS ====================

  static _generateComponents(material) {
    const commonComponents = {
      'Stainless Steel': ['Material blank', 'Coolant', 'Lubricant', 'Degreaser'],
      'Aluminum': ['Material blank', 'Cutting fluid', 'Lubricant', 'Cleaner'],
      'Carbon Steel': ['Material blank', 'Coolant', 'Lubricant', 'Rust inhibitor'],
      'SUS304': ['SUS304 blank', 'Cutting fluid', 'Lubricant', 'Degreaser', 'Passivation chemicals'],
      'default': ['Raw material', 'Coolant', 'Lubricant']
    };
    return commonComponents[material] || commonComponents['default'];
  }

  static _generateTools(complexity) {
    const toolMap = {
      'Simple': ['Measuring tape', 'Hacksaw', 'Files', 'Safety equipment'],
      'Medium': ['CNC Machine', 'Calipers', 'Micrometer', 'Surface finish tools', 'Deburring tools', 'Safety equipment'],
      'Complex': ['CNC Machine', 'Precision Calipers', 'Micrometer', 'Roughness meter', 'CMM', 'Heat treatment oven', 'Coating equipment', 'Safety equipment']
    };
    return toolMap[complexity] || toolMap['Medium'];
  }

  static _generateSafetyPrecautions(material) {
    const safetyMap = {
      'Stainless Steel': ['Use proper PPE', 'Handle sharp edges carefully', 'Ensure proper ventilation', 'Secure workpiece firmly'],
      'Aluminum': ['Prevent dust inhalation', 'Use proper PPE', 'Avoid sparks near aluminum dust', 'Secure workpiece firmly'],
      'Carbon Steel': ['Use proper ventilation', 'Handle hot materials with care', 'Use PPE during cutting', 'Proper coolant handling'],
      'SUS304': ['Chemical-resistant gloves', 'Proper ventilation', 'Avoid cross-contamination', 'Handle with care to prevent scratches'],
      'default': ['Use appropriate PPE', 'Ensure proper ventilation', 'Secure workpiece firmly', 'Follow safety guidelines']
    };
    return safetyMap[material] || safetyMap['default'];
  }

  static _getMaterialSpecifications(material) {
    const specs = {
      'Stainless Steel': {
        'Material Grade': 'Grade 304/316',
        'Density': '8.0 g/cm³',
        'Tensile Strength': 'Min 515 MPa',
        'Hardness': 'Max 217 HV',
        'Corrosion Resistance': 'High',
        'Temperature Range': '-50°C to 400°C'
      },
      'SUS304': {
        'Material Grade': 'JIS SUS304',
        'Density': '7.93 g/cm³',
        'Tensile Strength': 'Min 520 MPa',
        'Hardness': 'Max 217 HV',
        'Corrosion Resistance': 'Excellent',
        'Temperature Range': '-50°C to 425°C'
      },
      'Aluminum': {
        'Material Grade': '6061-T6',
        'Density': '2.7 g/cm³',
        'Tensile Strength': 'Min 310 MPa',
        'Hardness': 'Max 95 HB',
        'Corrosion Resistance': 'Good',
        'Temperature Range': '-50°C to 120°C'
      },
      'default': {
        'Density': 'Per material spec',
        'Tensile Strength': 'Per material spec',
        'Hardness': 'Per material spec'
      }
    };
    return specs[material] || specs['default'];
  }

  static _getDefaultTolerances(material) {
    const tolerances = {
      'Stainless Steel': { 'Standard Tolerance': '±0.2mm', 'Surface Finish': 'Ra 0.8μm', 'Hardness': 'Max 217 HV' },
      'SUS304': { 'Standard Tolerance': '±0.1mm', 'Surface Finish': 'Ra 0.8μm', 'Hardness': 'Max 217 HV' },
      'Aluminum': { 'Standard Tolerance': '±0.15mm', 'Surface Finish': 'Ra 1.6μm', 'Hardness': 'Max 95 HB' },
      'default': { 'Standard Tolerance': '±0.5mm', 'Surface Finish': 'Ra 3.2μm' }
    };
    return tolerances[material] || tolerances['default'];
  }

  static _createInspectionItems(specs) {
    const items = [];

    // Create inspection items for key specifications
    Object.keys(specs).forEach(specKey => {
      const specValue = specs[specKey];

      // Skip non-dimensional specs
      if (this._isDimensionalSpec(specKey)) {
        items.push({
          name: specKey,
          expectedValue: specValue,
          method: this._getInspectionMethod(specKey),
          acceptanceCriteria: specValue,
          frequency: 'Every unit',
          status: 'Pending'
        });
      }
    });

    // Add standard checks
    items.push(
      { name: 'Visual Inspection', expectedValue: 'No defects', method: 'Visual', acceptanceCriteria: 'No visible defects', frequency: 'Every unit', status: 'Pending' },
      { name: 'Completeness Check', expectedValue: 'All features present', method: 'Visual & dimensional', acceptanceCriteria: 'All features present', frequency: 'Every unit', status: 'Pending' }
    );

    return items;
  }

  static _isDimensionalSpec(key) {
    const dimensionalKeywords = ['diameter', 'thickness', 'length', 'width', 'height', 'radius', 'tolerance', 'mm', 'finish', 'roughness', 'hole', 'distance'];
    return dimensionalKeywords.some(keyword => key.toLowerCase().includes(keyword));
  }

  static _getInspectionMethod(specKey) {
    const methodMap = {
      'diameter': 'Caliper/Micrometer',
      'thickness': 'Micrometer',
      'length': 'Measuring tape/Calipers',
      'width': 'Calipers',
      'hole': 'Plug gauge/Calipers',
      'roughness': 'Roughness meter',
      'finish': 'Visual & Roughness meter',
      'tolerance': 'CMM/Precision instrument',
      'default': 'Standard measurement'
    };

    for (let [key, method] of Object.entries(methodMap)) {
      if (specKey.toLowerCase().includes(key)) {
        return method;
      }
    }
    return methodMap['default'];
  }

  static _identifyCriticalItems(inspectionItems) {
    // Items that determine pass/fail
    return inspectionItems
      .filter(item => {
        const criticalKeywords = ['diameter', 'thickness', 'tolerance', 'hole', 'center', 'position'];
        return criticalKeywords.some(keyword => item.name.toLowerCase().includes(keyword));
      })
      .map(item => item.name);
  }

  static _getAllowableDefects(specifications) {
    // Based on material and specs, define what defects are acceptable
    return {
      minorScratchLength: '< 5mm',
      minorDentDepth: '< 0.5mm',
      roughnessVariance: '±10%',
      toleranceAcceptance: '95% of tolerance range'
    };
  }
}

module.exports = ZumenAIService;
