"""
OpenMechanic Fan Generator
Generates a parametric fan/impeller STL using CadQuery
Can be run as a standalone script or imported as a module
"""
import json
import sys
import argparse
from pathlib import Path
from dataclasses import dataclass, asdict
from typing import Optional

import cadquery as cq
from cadquery import exporters


@dataclass
class FanParameters:
    blade_diameter: float = 400.0      # mm
    blade_count: int = 5
    pitch_angle: float = 30.0          # degrees
    hub_diameter: float = 60.0         # mm
    blade_thickness: float = 3.0       # mm
    motor_shaft_diameter: float = 8.0  # mm
    blade_chord_root: float = 80.0     # mm
    blade_chord_tip: float = 40.0      # mm
    hub_height: float = 20.0           # mm
    fillet_radius: float = 1.0         # mm


def create_fan_geometry(params: FanParameters) -> cq.Workplane:
    """
    Create a parametric fan/impeller geometry using CadQuery
    """
    # Validate parameters
    if params.blade_diameter <= params.hub_diameter:
        raise ValueError("Blade diameter must be greater than hub diameter")
    if params.blade_count < 2:
        raise ValueError("Blade count must be at least 2")
    if params.pitch_angle <= 0 or params.pitch_angle >= 90:
        raise ValueError("Pitch angle must be between 0 and 90 degrees")
    
    # Calculate derived dimensions
    blade_radius = params.blade_diameter / 2
    hub_radius = params.hub_diameter / 2
    blade_span = blade_radius - hub_radius
    
    # Start with the hub
    hub = (
        cq.Workplane("XY")
        .circle(hub_radius)
        .extrude(params.hub_height)
    )
    
    # Add motor shaft hole
    hub = hub.faces(">Z").workplane().circle(params.motor_shaft_diameter / 2).cutThruAll()
    
    # Add keyway slot for motor shaft (standard 3mm keyway for 8mm shaft)
    if params.motor_shaft_diameter >= 8:
        keyway_width = 3.0
        keyway_depth = 1.4
        hub = (
            hub.faces(">Z")
            .workplane()
            .center(0, hub_radius - keyway_depth)
            .rect(keyway_width, params.hub_height + 2)
            .cutThruAll()
        )
    
    # Create blades
    blades = cq.Workplane("XY")
    
    for i in range(params.blade_count):
        angle = i * (360 / params.blade_count)
        
        # Create a single blade profile
        blade = create_blade_profile(params, blade_span, hub_radius)
        
        # Rotate and position blade
        blade = blade.rotate((0, 0, 0), (0, 0, 1), angle)
        blade = blade.translate((0, 0, 0))
        
        blades = blades.union(blade)
    
    # Combine hub and blades
    fan = hub.union(blades)
    
    # Add fillets to blade roots for stress relief
    fan = fan.edges("|Z and <Z").fillet(params.fillet_radius)
    
    return fan


def create_blade_profile(params: FanParameters, blade_span: float, hub_radius: float) -> cq.Workplane:
    """
    Create a single blade using loft between root and tip airfoil sections
    """
    # Convert pitch angle to radians for calculations
    import math
    pitch_rad = math.radians(params.pitch_angle)
    
    # Root section (at hub)
    root_chord = params.blade_chord_root
    root_thickness = params.blade_thickness
    
    # Tip section
    tip_chord = params.blade_chord_tip
    tip_thickness = params.blade_thickness * 0.5  # Taper thickness
    
    # Create root airfoil profile (simplified NACA-like)
    root_profile = create_airfoil_section(root_chord, root_thickness, pitch_rad, 0)
    
    # Create tip airfoil profile
    tip_profile = create_airfoil_section(tip_chord, tip_thickness, pitch_rad, blade_span)
    
    # Loft between root and tip
    blade = cq.Workplane("XY")
    
    # We need to create wires for lofting
    # Create root face
    root_face = (
        cq.Workplane("XY")
        .center(hub_radius, 0)
        .polyline(root_profile)
        .close()
        .extrude(0.1)  # Thin extrusion to make a face
    )
    
    # Create tip face
    tip_face = (
        cq.Workplane("XY")
        .center(hub_radius + blade_span, 0)
        .polyline(tip_profile)
        .close()
        .extrude(0.1)
    )
    
    # Loft between them
    blade = root_face.loft([tip_face.faces(">Z").val()])
    
    return blade


def create_airfoil_section(chord: float, thickness: float, pitch_rad: float, span_position: float) -> list:
    """
    Create a simplified airfoil section profile points
    Returns list of (x, y) points for polyline
    """
    import math
    
    # Number of points for upper and lower surfaces
    n_points = 20
    points = []
    
    # Generate upper surface (suction side)
    for i in range(n_points + 1):
        x_frac = i / n_points
        x = x_frac * chord
        
        # NACA 4-digit style thickness distribution
        # y_t = 5 * t * (0.2969*sqrt(x) - 0.1260*x - 0.3516*x^2 + 0.2843*x^3 - 0.1015*x^4)
        t = thickness / chord
        y_t = 5 * t * (
            0.2969 * math.sqrt(x_frac) 
            - 0.1260 * x_frac 
            - 0.3516 * x_frac**2 
            + 0.2843 * x_frac**3 
            - 0.1015 * x_frac**4
        ) * chord
        
        # Apply pitch rotation
        y_rotated = y_t * math.cos(pitch_rad) + (x - chord/4) * math.sin(pitch_rad)
        x_rotated = (x - chord/4) * math.cos(pitch_rad) - y_t * math.sin(pitch_rad) + chord/4
        
        points.append((x_rotated, y_rotated))
    
    # Generate lower surface (pressure side) - reverse order
    for i in range(n_points, -1, -1):
        x_frac = i / n_points
        x = x_frac * chord
        
        t = thickness / chord
        y_t = -5 * t * (
            0.2969 * math.sqrt(x_frac) 
            - 0.1260 * x_frac 
            - 0.3516 * x_frac**2 
            + 0.2843 * x_frac**3 
            - 0.1015 * x_frac**4
        ) * chord
        
        # Apply pitch rotation
        y_rotated = y_t * math.cos(pitch_rad) + (x - chord/4) * math.sin(pitch_rad)
        x_rotated = (x - chord/4) * math.cos(pitch_rad) - y_t * math.sin(pitch_rad) + chord/4
        
        points.append((x_rotated, y_rotated))
    
    return points


def create_simple_blade(params: FanParameters, blade_span: float, hub_radius: float) -> cq.Workplane:
    """
    Simpler blade creation using extrude with twist - more robust for CadQuery
    """
    import math
    
    # Create blade as a twisted extrusion
    # Start with a 2D profile at the root
    root_chord = params.blade_chord_root
    tip_chord = params.blade_chord_tip
    thickness = params.blade_thickness
    
    # Create trapezoidal blade profile
    half_thick = thickness / 2
    profile_points = [
        (0, -half_thick),
        (root_chord * 0.1, -half_thick * 1.2),
        (root_chord * 0.3, -thickness * 0.6),
        (root_chord * 0.7, -thickness * 0.3),
        (root_chord, 0),
        (root_chord * 0.7, thickness * 0.3),
        (root_chord * 0.3, thickness * 0.6),
        (root_chord * 0.1, half_thick * 1.2),
        (0, half_thick),
    ]
    
    # Create the blade using a swept path with twist
    # Path is an arc from hub to tip
    path_radius = hub_radius + blade_span / 2
    
    # Create a simple straight blade first, then twist it
    blade = (
        cq.Workplane("XY")
        .center(hub_radius, 0)
        .polyline(profile_points)
        .close()
        .extrude(blade_span)
    )
    
    # Apply twist by rotating each section
    # This is a simplified approach - for production, use proper lofting
    twist_angle = params.pitch_angle * (math.pi / 180)
    
    # Taper the blade
    blade = blade.taper(blade_span, (tip_chord / root_chord) - 1)
    
    return blade


def generate_fan_stl(params: FanParameters, output_path: str) -> dict:
    """
    Main function to generate fan STL file
    Returns metadata about the generated model
    """
    print(f"Generating fan with parameters: {params}")
    
    # Create geometry
    fan = create_fan_geometry(params)
    
    # Export STL
    exporters.export(fan, output_path, exportType="STL")
    
    # Calculate metadata
    bbox = fan.val().BoundingBox()
    volume = fan.val().Volume()
    
    metadata = {
        "parameters": asdict(params),
        "bounding_box": {
            "xmin": bbox.xmin,
            "xmax": bbox.xmax,
            "ymin": bbox.ymin,
            "ymax": bbox.ymax,
            "zmin": bbox.zmin,
            "zmax": bbox.zmax,
        },
        "dimensions": {
            "width": bbox.xmax - bbox.xmin,
            "depth": bbox.ymax - bbox.ymin,
            "height": bbox.zmax - bbox.zmin,
        },
        "volume_mm3": volume,
        "estimated_weight_g": volume * 1.04e-3,  # ABS density ~1.04 g/cm³
        "output_path": output_path,
    }
    
    print(f"Fan generated successfully: {output_path}")
    print(f"Dimensions: {metadata['dimensions']}")
    print(f"Volume: {volume:.2f} mm³")
    
    return metadata


def main():
    parser = argparse.ArgumentParser(description="Generate fan STL using CadQuery")
    parser.add_argument("input_json", help="Path to input JSON file with parameters")
    parser.add_argument("output_stl", help="Path to output STL file")
    args = parser.parse_args()
    
    # Load parameters from JSON
    with open(args.input_json, "r") as f:
        data = json.load(f)
    
    params_data = data.get("parameters", data)
    params = FanParameters(**params_data)
    
    # Generate STL
    metadata = generate_fan_stl(params, args.output_stl)
    
    # Print metadata as JSON for parsing
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()